// api/notion.js
// DGL Management System — Vercel Serverless Notion Proxy
// Database IDs and token are pre-configured — no env vars needed.

const NOTION_VERSION = "2026-03-11";
const BASE           = "https://api.notion.com/v1";

// ── Pre-configured credentials ────────────────────────────────────────────────
const TOKEN = process.env.NOTION_TOKEN || "ntn_p2167356953ak97R8tpMhLvOSrHbAIOoN43FhyORpII3gM";

const DB = {
  EMPLOYEES:     "32d0812f-3e19-80f9-be9c-f39ec13f8732",
  ATTENDANCE:    "32d0812f-3e19-8006-8ea8-c3ff6c74101c",
  LEAVE:         "32e0812f-3e19-802d-9310-e679d585badf",
  PROJECTS:      "32e0812f-3e19-8046-8b23-c51221b8856c",
  ASSET_REGISTER:"32d0812f-3e19-8056-b8d1-dc6868b2b6d1",
  TICKETS:       "32d0812f-3e19-80d5-ae62-c41991aa2c2d",
  MAINTENANCE:   "32d0812f-3e19-80e7-a025-c71f4a44aa2f",
  SYSTEM_ACCESS: "32d0812f-3e19-801d-89fa-e3a1dbb05ab3",
  INVOICE_UNPAID:"32d0812f-3e19-8068-b57b-e8bfbd679cd9",
  INVOICE_PAID:  "32d0812f-3e19-8037-841b-f61815db70a3",
};

// ── CORS ──────────────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── Notion fetch ──────────────────────────────────────────────────────────────
async function notionFetch(path, body = null) {
  const opts = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization:    `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type":   "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion ${res.status} on ${path}: ${err}`);
  }
  return res.json();
}

// ── Query full database (auto-paginates) ──────────────────────────────────────
async function queryDB(dbId, sorts = null) {
  let results = [], cursor;
  do {
    const body = { page_size: 100 };
    if (sorts)  body.sorts        = sorts;
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch(`/databases/${dbId}/query`, body);
    results = results.concat(data.results);
    cursor  = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

// ── Property extractor ────────────────────────────────────────────────────────
function p(page, name) {
  const prop = page.properties?.[name];
  if (!prop) return null;
  switch (prop.type) {
    case "title":        return prop.title?.map(t => t.plain_text).join("") || "";
    case "rich_text":    return prop.rich_text?.map(t => t.plain_text).join("") || "";
    case "number":       return prop.number ?? null;
    case "select":       return prop.select?.name ?? null;
    case "multi_select": return prop.multi_select?.map(s => s.name) ?? [];
    case "status":       return prop.status?.name ?? null;
    case "date":         return prop.date?.start ?? null;
    case "checkbox":     return prop.checkbox ?? false;
    case "people":       return prop.people?.map(u => u.name ?? u.id) ?? [];
    case "email":        return prop.email ?? null;
    case "phone_number": return prop.phone_number ?? null;
    case "url":          return prop.url ?? null;
    case "files":        return prop.files?.map(f => f.external?.url || f.file?.url) ?? [];
    case "formula":      return prop.formula?.string ?? prop.formula?.number ?? prop.formula?.boolean ?? null;
    case "rollup":
      if (prop.rollup?.type === "number") return prop.rollup.number;
      if (prop.rollup?.type === "array")  return prop.rollup.array?.length ?? 0;
      return null;
    case "relation":     return prop.relation?.map(r => r.id) ?? [];
    case "created_time": return prop.created_time ?? null;
    case "last_edited_time": return prop.last_edited_time ?? null;
    default:             return null;
  }
}

// ── Flexible property reader (tries multiple likely column names) ──────────────
function pAny(page, ...names) {
  for (const name of names) {
    const val = p(page, name);
    if (val !== null && val !== "" && !(Array.isArray(val) && val.length === 0)) return val;
  }
  return null;
}

// ── Page title fallback ───────────────────────────────────────────────────────
function pageTitle(page) {
  for (const prop of Object.values(page.properties || {})) {
    if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "Untitled";
  }
  return "Untitled";
}

// ── Shapers ───────────────────────────────────────────────────────────────────
function shapeEmployee(pg) {
  return {
    id:           pg.id,
    name:         pageTitle(pg),
    role:         pAny(pg, "Role", "Job Title", "Position", "Title"),
    department:   pAny(pg, "Department", "Dept", "Team"),
    contract:     pAny(pg, "Contract", "Contract Type", "Employment Type"),
    startDate:    pAny(pg, "Start Date", "Date Joined", "Hire Date"),
    status:       pAny(pg, "Status", "Employment Status"),
    leaveBalance: pAny(pg, "Leave Balance", "Annual Leave Remaining", "Leave Days"),
    email:        pAny(pg, "Email", "Work Email"),
    phone:        pAny(pg, "Phone", "Phone Number", "Mobile"),
  };
}

function shapeAttendance(pg) {
  return {
    id:         pg.id,
    employee:   pAny(pg, "Employee", "Name", "Staff"),
    date:       pAny(pg, "Date", "Attendance Date"),
    status:     pAny(pg, "Status", "Attendance Status"),
    department: pAny(pg, "Department", "Dept"),
    notes:      pAny(pg, "Notes", "Remarks"),
  };
}

function shapeLeave(pg) {
  return {
    id:         pg.id,
    leaveId:    pAny(pg, "Leave ID", "ID", "Ref"),
    employee:   pAny(pg, "Employee", "Name", "Staff Member"),
    type:       pAny(pg, "Leave Type", "Type"),
    from:       pAny(pg, "From", "Start Date", "Start"),
    to:         pAny(pg, "To", "End Date", "End"),
    days:       pAny(pg, "Days", "Number of Days", "Duration"),
    status:     pAny(pg, "Status"),
    approvedBy: pAny(pg, "Approved By", "Approver", "Manager"),
    notes:      pAny(pg, "Notes", "Reason", "Remarks"),
  };
}

function shapeProject(pg) {
  return {
    id:       pg.id,
    name:     pageTitle(pg),
    client:   pAny(pg, "Client", "Client Name"),
    pm:       pAny(pg, "Project Manager", "PM", "Lead", "Manager"),
    workers:  pAny(pg, "Workers", "Worker Count", "Team Size", "No. of Workers"),
    value:    pAny(pg, "Value", "Contract Value", "Budget", "Amount"),
    progress: pAny(pg, "Progress", "Completion", "% Complete"),
    deadline: pAny(pg, "Deadline", "Due Date", "End Date", "Target Date"),
    status:   pAny(pg, "Status", "Project Status"),
    site:     pAny(pg, "Site", "Location"),
  };
}

function shapeAsset(pg) {
  return {
    id:           pg.id,
    name:         pageTitle(pg),
    category:     pAny(pg, "Category", "Asset Type", "Type"),
    assetTag:     pAny(pg, "Asset Tag", "Tag", "Code", "ID"),
    serialNumber: pAny(pg, "Serial Number", "Serial", "S/N"),
    assignedTo:   pAny(pg, "Assigned To", "User", "Employee"),
    department:   pAny(pg, "Department", "Dept"),
    condition:    pAny(pg, "Condition", "State"),
    location:     pAny(pg, "Location", "Where"),
    value:        pAny(pg, "Value", "Cost", "Purchase Price"),
    dateLent:     pAny(pg, "Date Lent", "Loan Date", "Lent Date"),
    expectedReturn: pAny(pg, "Expected Return", "Return Date", "Due Back"),
    actualReturn: pAny(pg, "Actual Return", "Returned On"),
    conditionOut: pAny(pg, "Condition Out", "Condition When Lent"),
    conditionIn:  pAny(pg, "Condition In", "Condition On Return"),
    status:       pAny(pg, "Status", "Asset Status"),
    notes:        pAny(pg, "Notes", "Remarks"),
  };
}

function shapeTicket(pg) {
  return {
    id:         pg.id,
    ticketId:   pAny(pg, "Ticket ID", "ID", "Ref"),
    issue:      pageTitle(pg),
    assignedTo: pAny(pg, "Assigned To", "Assignee", "Technician"),
    category:   pAny(pg, "Category", "Type"),
    dateRaised: pAny(pg, "Date Raised", "Created", "Date"),
    priority:   pAny(pg, "Priority"),
    status:     pAny(pg, "Status"),
    notes:      pAny(pg, "Notes", "Description"),
  };
}

function shapeMaintenance(pg) {
  return {
    id:         pg.id,
    task:       pageTitle(pg),
    location:   pAny(pg, "Location", "Area", "Floor"),
    assignedTo: pAny(pg, "Assigned To", "Technician", "Engineer"),
    date:       pAny(pg, "Date", "Scheduled Date", "Due Date"),
    status:     pAny(pg, "Status"),
    notes:      pAny(pg, "Notes"),
  };
}

function shapeSystemAccess(pg) {
  return {
    id:         pg.id,
    name:       pageTitle(pg),
    employee:   pAny(pg, "Employee", "User", "Staff"),
    system:     pAny(pg, "System", "Application", "Software", "Platform"),
    accessLevel:pAny(pg, "Access Level", "Role", "Permission", "Level"),
    grantedBy:  pAny(pg, "Granted By", "Approved By", "Admin"),
    dateGranted:pAny(pg, "Date Granted", "Date", "Start Date"),
    expiryDate: pAny(pg, "Expiry", "Expiry Date", "End Date"),
    status:     pAny(pg, "Status"),
  };
}

function shapeInvoice(pg) {
  return {
    id:         pg.id,
    invoiceNum: pAny(pg, "Invoice #", "Invoice Number", "Ref") || pageTitle(pg),
    client:     pAny(pg, "Client", "Customer"),
    project:    pAny(pg, "Project", "Job"),
    amount:     pAny(pg, "Amount", "Amount (GHS)", "Value", "Total"),
    issueDate:  pAny(pg, "Issue Date", "Date", "Invoice Date"),
    dueDate:    pAny(pg, "Due Date", "Payment Due"),
    status:     pAny(pg, "Status"),
    notes:      pAny(pg, "Notes", "Remarks"),
  };
}

// ── KPI Calculator ────────────────────────────────────────────────────────────
function calcKPIs({ employees, attendance, leaves, projects, tickets, assets, invoicesPaid, invoicesUnpaid }) {
  const today = new Date().toISOString().split("T")[0];

  // HR
  const totalEmployees = employees.length;
  const presentToday   = attendance.filter(a => a.date === today && a.status?.toLowerCase().includes("present")).length;
  const absentToday    = attendance.filter(a => a.date === today && a.status?.toLowerCase().includes("absent")).length;
  const pendingLeaves  = leaves.filter(l => l.status?.toLowerCase().includes("pending")).length;
  const onLeaveToday   = leaves.filter(l =>
    l.from && l.to &&
    l.from <= today && l.to >= today &&
    l.status?.toLowerCase().includes("approved")
  ).length;

  // Projects
  const activeProjects  = projects.filter(p => {
    const s = (p.status || "").toLowerCase();
    return !s.includes("complet") && !s.includes("cancel") && !s.includes("close");
  }).length;
  const delayedProjects = projects.filter(p => (p.status || "").toLowerCase().includes("delay")).length;
  const totalWorkers    = projects.reduce((s, p) => s + (Number(p.workers) || 0), 0);

  // IT
  const openTickets     = tickets.filter(t => (t.status || "").toLowerCase().includes("open")).length;
  const criticalTickets = tickets.filter(t => (t.priority || "").toLowerCase().includes("critical")).length;
  const inProgressTickets = tickets.filter(t => (t.status || "").toLowerCase().includes("progress")).length;

  // Assets
  const assetsOnLoan   = assets.filter(a => (a.status || "").toLowerCase().includes("loan")).length;
  const overdueAssets  = assets.filter(a => (a.status || "").toLowerCase().includes("overdue")).length;
  const assetValue     = assets
    .filter(a => !a.actualReturn)
    .reduce((s, a) => s + (Number(a.value) || 0), 0);

  // Accounts — two invoice DBs merged
  const allInvoices    = [...invoicesPaid, ...invoicesUnpaid];
  const totalRevenue   = invoicesPaid.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const outstanding    = invoicesUnpaid.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const overdueInvoices= invoicesUnpaid.filter(i => (i.status || "").toLowerCase().includes("overdue")).length;

  return {
    hr:       { totalEmployees, presentToday, absentToday, pendingLeaves, onLeaveToday },
    projects: { activeProjects, delayedProjects, totalWorkers },
    it:       { openTickets, criticalTickets, inProgressTickets },
    accounts: { totalRevenue, outstanding, overdueInvoices, assetsOnLoan, overdueAssets, assetValue, totalInvoices: allInvoices.length },
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Fetch all 10 databases in parallel
    const [
      employeePages, attendancePages, leavePages, projectPages,
      assetPages, ticketPages, maintenancePages, systemAccessPages,
      invoiceUnpaidPages, invoicePaidPages,
    ] = await Promise.all([
      queryDB(DB.EMPLOYEES),
      queryDB(DB.ATTENDANCE,   [{ property: "Date",       direction: "descending" }]),
      queryDB(DB.LEAVE,        [{ property: "From",       direction: "descending" }]),
      queryDB(DB.PROJECTS),
      queryDB(DB.ASSET_REGISTER),
      queryDB(DB.TICKETS,      [{ property: "Date Raised",direction: "descending" }]),
      queryDB(DB.MAINTENANCE),
      queryDB(DB.SYSTEM_ACCESS),
      queryDB(DB.INVOICE_UNPAID),
      queryDB(DB.INVOICE_PAID),
    ]);

    const employees     = employeePages.map(shapeEmployee);
    const attendance    = attendancePages.map(shapeAttendance);
    const leaves        = leavePages.map(shapeLeave);
    const projects      = projectPages.map(shapeProject);
    const assets        = assetPages.map(shapeAsset);
    const tickets       = ticketPages.map(shapeTicket);
    const maintenance   = maintenancePages.map(shapeMaintenance);
    const systemAccess  = systemAccessPages.map(shapeSystemAccess);
    const invoicesUnpaid= invoiceUnpaidPages.map(shapeInvoice);
    const invoicesPaid  = invoicePaidPages.map(shapeInvoice);

    const kpis = calcKPIs({ employees, attendance, leaves, projects, tickets, assets, invoicesPaid, invoicesUnpaid });

    res.status(200).json({
      lastUpdated: new Date().toISOString(),
      kpis,
      hr:       { employees, attendance, leaves },
      projects,
      it:       { tickets, maintenance, systemAccess },
      accounts: { invoicesPaid, invoicesUnpaid, assets },
    });

  } catch (err) {
    console.error("[DGL API Error]", err.message);
    res.status(500).json({ error: err.message });
  }
}
