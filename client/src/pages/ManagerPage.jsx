import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";

import {
  getTools,
  createTool,
  updateTool,
  deleteTool,
  batchUpdateStock
} from "../services/toolService";

import { processInvoiceOCR } from "../services/ocrService";


import {
  getRequests,
  approveRequest,
  rejectRequest,
  mergeUserRequests
} from "../services/requestService";

import {
  getReturnRequests,
  approveReturnRequest,
  rejectReturnRequest
} from "../services/returnService";


const ManagerPage = () => {

  const [tools, setTools] = useState([]);
  const [requests, setRequests] = useState([]);

  const [view, setView] = useState("dashboard");
  const [returnRequests, setReturnRequests] = useState([]);

  // 🔥 OCR STATES
  const [ocrResults, setOcrResults] = useState([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [successNotification, setSuccessNotification] = useState("");
  const [successAlertMessage, setSuccessAlertMessage] = useState("");
  const [pendingRemaining, setPendingRemaining] = useState(null);
  const [openDropdownIdx, setOpenDropdownIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenDropdownIdx(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleCloseSuccessAlert = () => {
    if (pendingRemaining !== null) {
      setOcrResults(pendingRemaining);
      setPendingRemaining(null);
    }
    fetchTools();
    setSuccessAlertMessage("");
  };

  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => {
        setSuccessNotification("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  const requestSectionRef = useRef(null);

  const [form, setForm] = useState({
    tool_name: "",
    category: "",
    total_quantity: "",
    description: "",
    unit_price: ""
  });

  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState("pending");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  // 🔥 SORTING
  const [sortField, setSortField] = useState("id");

  const [sortOrder, setSortOrder] = useState("asc");

  // 🔥 PAGINATION
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    fetchTools();
    fetchRequests();
    fetchReturnRequests();
  }, []);

  // Sync new tools with OCR candidate list automatically
  useEffect(() => {
    if (ocrResults.length > 0 && tools.length > 0) {
      const updated = ocrResults.map(res => {
        if (!res.tool_id) {
          const match = tools.find(t => t.tool_name.toLowerCase() === res.raw_name.toLowerCase());
          if (match) {
            return {
              ...res,
              tool_id: match.id,
              matched_name: match.tool_name
            };
          }
        }
        return res;
      });

      const changed = updated.some((res, idx) => res.tool_id !== ocrResults[idx].tool_id);
      if (changed) {
        setOcrResults(updated);
      }
    }
  }, [tools]);

  // 🔥 FETCH TOOLS
  const fetchTools = async () => {
    const data = await getTools();
    setTools(data);
  };

  // 🔥 FETCH REQUESTS
  const fetchRequests = async () => {
    const data = await getRequests();
    setRequests(data);
  };

  // 🔥 FETCH RETURN REQUESTS
  const fetchReturnRequests = async () => {
    try {
      const data = await getReturnRequests();
      setReturnRequests(data);
    } catch (err) {
      console.error("Error fetching return requests:", err);
    }
  };

  const handleApproveReturn = async (id) => {
    if (!window.confirm("Approve this return and restock inventory?")) return;
    try {
      await approveReturnRequest(id);
      setSuccessNotification("Return approved and stock updated successfully!");
      fetchReturnRequests();
      fetchTools();
    } catch (err) {
      alert(err.response?.data || "Error approving return");
    }
  };

  const handleRejectReturn = async (id) => {
    if (!window.confirm("Reject this return report?")) return;
    try {
      await rejectReturnRequest(id);
      setSuccessNotification("Return report rejected successfully!");
      fetchReturnRequests();
    } catch (err) {
      alert("Error rejecting return");
    }
  };

  // 🔥 OCR HANDLERS
  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsOcrLoading(true);
    try {
      const candidates = await processInvoiceOCR(file);
      // Enrich with tool matching
      const enriched = candidates.map(c => {
        // Attempt fuzzy match or exact match
        const match = tools.find(t => t.tool_name.toLowerCase() === c.raw_name.toLowerCase());
        return {
          ...c,
          tool_id: match ? match.id : null,
          matched_name: match ? match.tool_name : ""
        };
      });
      setOcrResults(enriched);
    } catch (err) {
      alert("Failed to process OCR");
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleBatchStockSubmit = async () => {
    const updates = ocrResults
      .filter(res => res.tool_id && !isNaN(res.tool_id))
      .map(res => ({ 
        id: Number(res.tool_id), 
        quantity: isNaN(res.quantity) ? 0 : Number(res.quantity) 
      }))
      .filter(up => up.quantity > 0 && !isNaN(up.id));

    if (updates.length === 0) {
      alert("No valid tools matched with positive quantity. Please match items before submitting.");
      return;
    }

    try {
      await batchUpdateStock(updates);
      
      // Calculate remaining items
      const restockedToolIds = new Set(updates.map(u => u.id));
      const remaining = ocrResults.filter(res => !res.tool_id || !restockedToolIds.has(Number(res.tool_id)));
      
      // Stage remaining items to be cleared AFTER clicking "OK"
      setPendingRemaining(remaining);
      setSuccessAlertMessage("items restocked successfully");
    } catch (err) {
      alert("Error updating batch stock: " + (err.response?.data || err.message));
    }
  };



  // 🔥 SAVE TOOL
  const handleSave = async () => {

    const duplicate = tools.find(
      (tool) =>
        tool.tool_name.toLowerCase() ===
        form.tool_name.toLowerCase() &&
        tool.category.toLowerCase() ===
        form.category.toLowerCase() &&
        tool.id !== editingId
    );

    if (duplicate) {
      alert("Tool already exists");
      return;
    }

    if (!form.tool_name.trim()) {
      alert("Tool name is required");
      return;
    }

    if (!form.category.trim()) {
      alert("Category is required");
      return;
    }

    if (!form.total_quantity) {
      alert("Quantity is required");
      return;
    }

    if (
      Number(form.total_quantity) <= 0
    ) {
      alert(
        "Quantity must be greater than 0"
      );
      return;
    }

    const payload = {
      ...form,
      total_quantity: Number(
        form.total_quantity
      ),
      unit_price: (form.unit_price === "" || form.unit_price === null) ? 0 : parseFloat(form.unit_price)
    };

    if (editingId) {
      await updateTool(
        editingId,
        payload
      );
      setSuccessNotification("Tool updated successfully!");
    } else {
      await createTool(payload);
      setSuccessNotification("Tool created successfully!");
    }

    setForm({
      tool_name: "",
      category: "",
      total_quantity: "",
      description: "",
      unit_price: ""
    });

    setEditingId(null);
    setSearch("");

    await fetchTools();
    if (ocrResults.length > 0) {
      setView("newStock");
    }
  };

  // 🔥 EDIT
  const handleEdit = (tool) => {

    setForm({
      tool_name: tool.tool_name,
      category: tool.category,
      total_quantity:
        tool.total_quantity,
      description:
        tool.description || "",
      unit_price: (tool.unit_price !== null && tool.unit_price !== undefined) ? tool.unit_price : ""
    });

    setEditingId(tool.id);
  };

  // 🔥 DELETE
  const handleDelete = async (id) => {

    await deleteTool(id);
    setSuccessNotification("Tool deleted successfully!");
    fetchTools();
  };

  const handleApproveDC = async (items) => {
    try {
      for (const item of items) {
        await approveRequest(item.id);
      }
      setSuccessNotification("Delivery Challan approved successfully!");
      fetchRequests();
      fetchTools();
    } catch (err) {
      console.error(err);
      alert(err.response?.data || "Error approving requests");
    }
  };

  const handleRejectDC = async (items) => {
    try {
      for (const item of items) {
        await rejectRequest(item.id);
      }
      setSuccessNotification("Delivery Challan requests rejected successfully!");
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.response?.data || "Error rejecting requests");
    }
  };

  const handleMergeRequests = async (userId) => {
    try {
      await mergeUserRequests(userId);
      setSuccessNotification("User's pending requests merged successfully!");
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.response?.data || "Error merging requests");
    }
  };

  // 🔥 SORT HANDLER
  const handleSort = (field) => {

    if (sortField === field) {

      setSortOrder(
        sortOrder === "asc"
          ? "desc"
          : "asc"
      );

    } else {

      setSortField(field);

      setSortOrder("asc");
    }
  };

  // 🔍 FILTER + SORT
  const filteredTools = tools
    .filter((tool) =>
      `${tool.tool_name} ${tool.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )

    .sort((a, b) => {

      let valueA = a[sortField];
      let valueB = b[sortField];

      // 🔥 NUMERIC SORT FOR SPECIFIC FIELDS
      if (["id", "total_quantity", "available_quantity", "unit_price"].includes(sortField)) {
        valueA = Number(valueA) || 0;
        valueB = Number(valueB) || 0;
      } else if (typeof valueA === "string") {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (sortOrder === "asc") {

        return valueA > valueB
          ? 1
          : -1;

      } else {

        return valueA < valueB
          ? 1
          : -1;
      }
    });

  // 🔥 PAGINATION
  const totalPages = Math.ceil(
    filteredTools.length /
    itemsPerPage
  );

  const paginatedTools =
    filteredTools.slice(
      (currentPage - 1) *
      itemsPerPage,

      currentPage *
      itemsPerPage
    );

  // 🔍 REQUEST FILTER
  const filteredRequests =
    requests
      .filter(
        (req) =>
          req.status === activeTab
      )

      .filter((req) => {

        if (
          !fromDate ||
          !toDate
        ) {
          return true;
        }

        const reqDate =
          req.request_date?.split(
            "T"
          )[0];

        return (
          reqDate >= fromDate &&
          reqDate <= toDate
        );
      });

  // 📦 GROUP REQUESTS BY DC NUMBER
  const groupedRequests = Object.values(
    filteredRequests.reduce((acc, req) => {
      const dc = req.dc_number || "N/A";
      if (!acc[dc]) {
        acc[dc] = {
          dc_number: dc,
          user_name: req.user_name || req.user_id,
          request_date: req.request_date,
          status: req.status,
          items: []
        };
      }
      acc[dc].items.push(req);
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

  // 📊 ANALYTICS
  const totalTools =
    tools.length;

  const pendingReturnsCount = returnRequests.filter(r => r.status === "pending").length;


  const lowStockTools =
    tools.filter(
      (t) =>
        (
          t.available_quantity || 0
        ) > 0 &&
        (
          t.available_quantity || 0
        ) < 3
    );

  const outOfStockTools =
    tools.filter(
      (t) =>
        (
          t.available_quantity || 0
        ) === 0
    );

  const lowStock =
    lowStockTools.length;

  const outOfStock =
    outOfStockTools.length;

  const totalRequests =
    requests.length;

  // 📊 EXPORT APPROVED REQUESTS TO EXCEL
  const handleExportExcel = async () => {
    try {
      if (groupedRequests.length === 0) {
        alert("No approved requests to export.");
        return;
      }

      console.log("Exporting grouped requests:", groupedRequests.length);
      
      // Dynamic import of ExcelJS
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Approved Requests");

      // Define Columns to match user screenshot order
      worksheet.columns = [
        { header: "DC Number", key: "dc", width: 20 },
        { header: "Employee", key: "employee", width: 20 },
        { header: "Tool Name", key: "tool", width: 30 },
        { header: "Quantity", key: "qty", width: 10 },
        { header: "Price", key: "totalPrice", width: 15 },
        { header: "Unit Price", key: "unitPrice", width: 15 },
        { header: "Date", key: "date", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Client", key: "client", width: 25 },
        { header: "PO Number", key: "po", width: 20 }
      ];

      // Add Rows
      groupedRequests.forEach(group => {
        group.items.forEach(item => {
          worksheet.addRow({
            dc: String(group.dc_number || "N/A"),
            employee: String(group.user_name || "N/A"),
            tool: String(item.tool_name || "N/A"),
            qty: Number(item.approved_quantity || item.quantity || 0),
            totalPrice: Number(item.price || 0),
            unitPrice: Number(item.unit_price || 0),
            date: String(group.request_date?.split("T")[0] || "N/A"),
            status: String(group.status || "N/A"),
            client: String(item.client_name || "N/A"),
            po: String(item.po_number || "N/A")
          });
        });
      });

      // Styling headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Generate Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const data = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `Approved_Requests_${dateStr}.xlsx`;

      // Use file-saver for the download
      const { saveAs } = await import("file-saver");
      saveAs(data, fileName);

      console.log("Download triggered for:", fileName);
      alert("Excel file generated successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export Excel: " + err.message);
    }
  };

  return (
    <div>

      {successNotification && (
        <div 
          className="glass-panel" 
          style={{ 
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "rgba(16, 185, 129, 0.95)", 
            backdropFilter: "blur(12px)",
            border: "1px solid var(--success)", 
            color: "#e6fbf4", 
            padding: "16px 24px", 
            borderRadius: "12px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            gap: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
            minWidth: "300px",
            maxWidth: "90%"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>✅</span>
            <span style={{ fontWeight: "600", letterSpacing: "0.5px" }}>{successNotification}</span>
          </div>
          <button 
            onClick={() => setSuccessNotification("")} 
            style={{ 
              background: "none", 
              border: "none", 
              color: "inherit", 
              cursor: "pointer", 
              fontSize: "18px",
              padding: "4px"
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* LOW STOCK PAGE */}
      {view === "low" && (

        <div>

          <button
            onClick={() =>
              setView("dashboard")
            }
          >
            Back
          </button>

          <h2>
            Low Stock Items
          </h2>

          <table
            border="1"
            cellPadding="10"
            style={{
              width: "100%",
              borderCollapse:
                "collapse"
            }}
          >

            <thead>
              <tr>
                <th>ID</th>
                <th>Tool</th>
                <th>Available</th>
              </tr>
            </thead>

            <tbody>

              {lowStockTools.map(
                (tool) => (

                  <tr
                    key={tool.id}
                  >
                    <td>
                      {tool.id}
                    </td>

                    <td>
                      {
                        tool.tool_name
                      }
                    </td>

                    <td
                      style={{
                        color:
                          "var(--warning)",
                        fontWeight:
                          "bold"
                      }}
                    >
                      {
                        tool.available_quantity
                      }
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* OUT OF STOCK */}
      {view === "out" && (

        <div>

          <button
            onClick={() =>
              setView("dashboard")
            }
          >
            Back
          </button>

          <h2>
            Out Of Stock Items
          </h2>

          <table
            border="1"
            cellPadding="10"
            style={{
              width: "100%",
              borderCollapse:
                "collapse"
            }}
          >

            <thead>
              <tr>
                <th>ID</th>
                <th>Tool</th>
              </tr>
            </thead>

            <tbody>

              {outOfStockTools.map(
                (tool) => (

                  <tr
                    key={tool.id}
                  >
                    <td>
                      {tool.id}
                    </td>

                    <td
                      style={{
                        color: "var(--danger)",
                        fontWeight:
                          "bold"
                      }}
                    >
                      {
                        tool.tool_name
                      }
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MAIN DASHBOARD */}
      {view === "dashboard" && (
        <>

          <h2 style={{ marginBottom: "24px" }}>
            Manager Analytics Dashboard
          </h2>

          {/* 🔥 ANALYTICS CARDS */}

          <div className="dashboard-grid" style={{ marginBottom: "32px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="stat-card">
              <h4>Total Tools</h4>
              <div className="value">{totalTools}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => setView("low")}
              style={{ cursor: "pointer", borderColor: "rgba(245, 158, 11, 0.3)" }}
            >
              <h4 style={{ color: "var(--warning)" }}>Low Stock</h4>
              <div className="value">{lowStock}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => setView("out")}
              style={{ cursor: "pointer", borderColor: "rgba(239, 68, 68, 0.3)" }}
            >
              <h4 style={{ color: "var(--danger)" }}>Out Of Stock</h4>
              <div className="value">{outOfStock}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => requestSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
              style={{ cursor: "pointer", borderColor: "rgba(59, 130, 246, 0.3)" }}
            >
              <h4 style={{ color: "var(--accent-primary)" }}>Requests</h4>
              <div className="value">{totalRequests}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => setView("returns")}
              style={{ cursor: "pointer", borderColor: "rgba(16, 185, 129, 0.3)" }}
            >
              <h4 style={{ color: "var(--success)" }}>Verify Returns</h4>
              <div className="value">{pendingReturnsCount}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => setView("newStock")}
              style={{ cursor: "pointer", borderColor: "rgba(139, 92, 246, 0.3)" }}
            >
              <h4 style={{ color: "var(--accent-primary)" }}>New Stock</h4>
              <div className="value">Upload</div>
            </div>
          </div>



          {/* 🔥 CRUD */}

          <div className="glass-panel" style={{ marginBottom: "32px" }}>
            <h3>Manage Inventory</h3>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Tool Name</label>
                <input
                  type="text"
                  placeholder="Tool Name"
                  value={form.tool_name}
                  onChange={(e) => setForm({ ...form, tool_name: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Category</label>
                <input
                  type="text"
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ flex: "1 1 120px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Quantity</label>
                <input
                  type="number"
                  placeholder="Quantity"
                  value={form.total_quantity}
                  onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Description</label>
                <input
                  type="text"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ flex: "1 1 120px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Unit Price</label>
                <input
                  type="number"
                  placeholder="Unit Price"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <button
                onClick={handleSave}
                className="btn-primary"
                style={{ padding: "12px 24px" }}
              >
                {editingId ? "Update Tool" : "Add Tool"}
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ margin: 0 }}>Inventory Table ({filteredTools.length} tools)</h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "250px", marginBottom: 0 }}
                />
                <button onClick={() => setSearch("")} className="btn-secondary">Clear</button>
              </div>
            </div>

            <div className="modern-table-container">
              <table>

                <thead>

                  <tr>

                    <th
                      onClick={() =>
                        handleSort(
                          "id"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      ID
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "tool_name"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      Name
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "category"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      Category
                    </th>

                    <th>
                      Description
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "total_quantity"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      Total
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "available_quantity"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      Available
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "unit_price"
                        )
                      }

                      style={{
                        cursor:
                          "pointer"
                      }}
                    >
                      Unit Price
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {paginatedTools.map(
                    (tool) => {

                      const available =
                        tool.available_quantity || 0;

                      return (

                        <tr
                          key={tool.id}

                          onMouseEnter={(e) =>
                            e.currentTarget.style.opacity =
                            "0.9"
                          }

                          onMouseLeave={(e) =>
                            e.currentTarget.style.opacity =
                            "1"
                          }

                          style={{
                            backgroundColor:
                              available === 0
                                ? "rgba(239, 68, 68, 0.2)"
                                : available < 3
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "transparent"
                          }}
                        >

                          <td>
                            {tool.id}
                          </td>

                          <td>
                            {
                              tool.tool_name
                            }
                          </td>

                          <td>
                            {
                              tool.category
                            }
                          </td>

                          <td>
                            {
                              tool.description
                            }
                          </td>

                          <td>
                            {
                              tool.total_quantity
                            }
                          </td>

                          <td>
                            {
                              available
                            }
                          </td>

                          <td>
                            ₹{Number(tool.unit_price || 0).toFixed(2)}
                          </td>

                          <td>

                            <button
                              onClick={() => handleEdit(tool)}
                              className="btn-primary"
                              style={{ marginRight: "8px", padding: "6px 12px", fontSize: "12px" }}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDelete(tool.id)}
                              className="btn-danger"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* 🔥 PAGINATION */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="btn-secondary"
                style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ color: "var(--text-secondary)" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="btn-secondary"
                style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>

          {/* DATE FILTER */}

          <div
            style={{
              marginBottom:
                "10px"
            }}
          >

            {/* REQUEST SECTION */}
            <div className="glass-panel" ref={requestSectionRef}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
                <h3 style={{ margin: 0 }}>Requests Management</h3>

                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ marginBottom: 0 }} />
                    <span style={{ color: "var(--text-secondary)", alignSelf: "center" }}>to</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ marginBottom: 0 }} />
                  </div>

                  <div style={{ display: "flex", gap: "8px", background: "rgba(15, 23, 42, 0.6)", padding: "4px", borderRadius: "8px" }}>
                    <button onClick={() => setActiveTab("pending")} className={activeTab === "pending" ? "btn-primary" : "btn-secondary"} style={{ border: "none" }}>Pending</button>
                    <button onClick={() => setActiveTab("approved")} className={activeTab === "approved" ? "btn-primary" : "btn-secondary"} style={{ border: "none" }}>Approved</button>
                    <button onClick={() => setActiveTab("rejected")} className={activeTab === "rejected" ? "btn-primary" : "btn-secondary"} style={{ border: "none" }}>Rejected</button>
                  </div>
                  {activeTab === "approved" && (
                    <button
                      onClick={handleExportExcel}
                      className="btn-success"
                      style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600" }}
                    >
                      📊 Export Excel
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      fetchRequests();
                      fetchTools();
                    }}
                    className="btn-secondary"
                    style={{ padding: "8px 12px" }}
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              <div className="modern-table-container">
                <table>

                  <thead>

                    <tr>
                      <th>DC Number</th>
                      <th>Type</th>
                      <th>Employee</th>
                      <th>Tools & Qty</th>
                      <th>Date</th>
                      <th>Status</th>

                      {activeTab ===
                        "pending" && (
                          <th>
                            Actions
                          </th>
                        )}
                    </tr>
                  </thead>

                  <tbody>

                    {groupedRequests.length === 0 ? (

                      <tr>
                        <td
                          colSpan="6"
                        >
                          No data
                        </td>
                      </tr>

                    ) : (

                      groupedRequests.map(
                        (group) => (

                          <tr
                            key={group.dc_number}
                          >

                            <td>
                              <span style={{ fontWeight: "bold", color: "var(--accent-primary)" }}>
                                {group.dc_number}
                              </span>
                            </td>

                            <td>
                              <span style={{ 
                                padding: "4px 8px", 
                                borderRadius: "4px", 
                                fontSize: "11px", 
                                fontWeight: "bold",
                                backgroundColor: group.items[0]?.returnable === false ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                                color: group.items[0]?.returnable === false ? "var(--warning)" : "var(--accent-primary)"
                              }}>
                                {group.items[0]?.returnable === false ? "Indent" : "Challan"}
                              </span>
                            </td>

                            <td>
                              {group.user_name}
                            </td>

                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {group.items.map((item, idx) => (
                                  <div key={idx} style={{ fontSize: "12px", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                                    {item.tool_name} <span style={{ color: "var(--text-secondary)", marginLeft: "4px" }}>x {item.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td>
                              {group.request_date?.split(
                                "T"
                              )[0]}
                            </td>

                            <td>
                              <span className={`badge badge-${group.status}`}>
                                {group.status}
                              </span>
                            </td>

                            {activeTab ===
                              "pending" && (

                                <td>
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <button
                                      onClick={() => handleApproveDC(group.items)}
                                      className="btn-success"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                    >
                                      Approve All
                                    </button>
                                    <button
                                      onClick={() => handleRejectDC(group.items)}
                                      className="btn-danger"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                    >
                                      Reject All
                                    </button>
                                    <button
                                      onClick={() => handleMergeRequests(group.items[0].user_id)}
                                      className="btn-secondary"
                                      style={{ padding: "6px 12px", fontSize: "12px", background: "rgba(59, 130, 246, 0.2)", color: "var(--accent-primary)", border: "1px solid var(--accent-primary)" }}
                                    >
                                      Merge All Pending For User
                                    </button>
                                  </div>
                                </td>
                              )}
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🔥 RETURNS VERIFICATION VIEW */}
      {view === "returns" && (
        <div className="glass-panel" style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>Verify Employee Returns</h2>
            <button onClick={() => setView("dashboard")} className="btn-secondary">Back to Dashboard</button>
          </div>

          <div className="modern-table-container">
            <table>
              <thead>
                <tr>
                  <th>DC Number</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Items Ticked</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returnRequests.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>No return reports found</td></tr>
                ) : (
                  returnRequests.map((req) => {
                    const items = typeof req.items === 'string' ? JSON.parse(req.items) : req.items;
                    const tickedItems = items.filter(i => i.returned);

                    return (
                      <tr key={req.id}>
                        <td><b style={{ color: "var(--accent-primary)" }}>{req.dc_number}</b></td>
                        <td>{req.user_name}</td>
                        <td>{new Date(req.created_at).toLocaleString()}</td>
                        <td>
                          <div style={{ fontSize: "12px" }}>
                            {tickedItems.map((item, idx) => (
                              <div key={idx}>• {item.tool_name} (Qty: {item.quantity})</div>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            background: req.status === "approved" ? "rgba(16, 185, 129, 0.2)" : req.status === "pending" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: req.status === "approved" ? "var(--success)" : req.status === "pending" ? "var(--warning)" : "var(--danger)",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            textTransform: "capitalize"
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td>
                          {req.status === "pending" && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => handleApproveReturn(req.id)} className="btn-primary" style={{ padding: "6px 12px", fontSize: "12px" }}>Approve</button>
                              <button onClick={() => handleRejectReturn(req.id)} className="btn-danger" style={{ padding: "6px 12px", fontSize: "12px" }}>Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔥 NEW STOCK INWARD (OCR) VIEW */}
      {view === "newStock" && (
        <div className="glass-panel" style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2>Inward New Stock (OCR)</h2>
            <button onClick={() => setView("dashboard")} className="btn-secondary">Back to Dashboard</button>
          </div>

          <div style={{ border: "2px dashed rgba(255,255,255,0.1)", padding: "40px", borderRadius: "12px", textAlign: "center", marginBottom: "32px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
              Upload Seller Invoice or Challan to extract items automatically.
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleOcrUpload}
              id="ocr-upload"
              style={{ display: "none" }}
            />
            <label htmlFor="ocr-upload" className="btn-primary" style={{ padding: "12px 32px", cursor: "pointer" }}>
              {isOcrLoading ? "Processing OCR..." : "Select Invoice File"}
            </label>
          </div>

          {ocrResults.length > 0 && (
            <div className="modern-table-container">
              <table style={{ marginBottom: "24px" }}>
                <thead>
                  <tr>
                    <th>Extracted Item</th>
                    <th>Quantity</th>
                    <th>Match with Inventory</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrResults.map((res, idx) => (
                    <tr key={idx}>
                      <td><span style={{ fontSize: "14px", fontWeight: "500" }}>{res.raw_name}</span></td>
                      <td>
                        <input
                          type="number"
                          value={isNaN(res.quantity) ? "" : res.quantity}
                          onChange={(e) => {
                            const updated = [...ocrResults];
                            const val = e.target.value;
                            updated[idx].quantity = val === "" ? NaN : parseInt(val, 10);
                            setOcrResults(updated);
                          }}
                          style={{ width: "60px", marginBottom: 0 }}
                        />
                      </td>
                      <td style={{ position: "relative" }}>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openDropdownIdx === idx) {
                              setOpenDropdownIdx(null);
                            } else {
                              setOpenDropdownIdx(idx);
                              setSearchQuery("");
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "6px",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            userSelect: "none",
                            boxSizing: "border-box"
                          }}
                        >
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>
                            {res.tool_id 
                              ? `${res.matched_name} (${tools.find(t => t.id === res.tool_id)?.category || ""})` 
                              : "-- Match Tool --"}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>▼</span>
                        </div>

                        {openDropdownIdx === idx && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              width: "100%",
                              zIndex: 100,
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--glass-border)",
                              borderRadius: "8px",
                              marginTop: "4px",
                              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                              padding: "8px",
                              boxSizing: "border-box"
                            }}
                          >
                            <input 
                              type="text"
                              placeholder="Search tool..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoFocus
                              style={{
                                width: "100%",
                                padding: "8px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: "4px",
                                color: "var(--text-primary)",
                                marginBottom: "8px",
                                boxSizing: "border-box"
                              }}
                            />
                            <div 
                              style={{
                                maxHeight: "200px",
                                overflowY: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px"
                              }}
                            >
                              <div
                                onClick={() => {
                                  const updated = [...ocrResults];
                                  updated[idx].tool_id = null;
                                  updated[idx].matched_name = "";
                                  setOcrResults(updated);
                                  setOpenDropdownIdx(null);
                                }}
                                style={{
                                  padding: "8px 10px",
                                  cursor: "pointer",
                                  borderRadius: "4px",
                                  color: "var(--text-secondary)",
                                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                                  fontSize: "13px"
                                }}
                              >
                                -- Match Tool --
                              </div>
                              {tools
                                .filter(t => 
                                  t.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  t.category.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map(t => (
                                  <div
                                    key={t.id}
                                    onClick={() => {
                                      const updated = [...ocrResults];
                                      updated[idx].tool_id = t.id;
                                      updated[idx].matched_name = t.tool_name;
                                      setOcrResults(updated);
                                      setOpenDropdownIdx(null);
                                    }}
                                    style={{
                                      padding: "8px 10px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      background: res.tool_id === t.id ? "rgba(16, 185, 129, 0.2)" : "transparent",
                                      color: res.tool_id === t.id ? "var(--success)" : "var(--text-primary)",
                                      fontSize: "13px"
                                    }}
                                    className="dropdown-item"
                                    onMouseEnter={(e) => {
                                      if (res.tool_id !== t.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    }}
                                    onMouseLeave={(e) => {
                                      if (res.tool_id !== t.id) e.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    <div style={{ fontWeight: "500" }}>{t.tool_name}</div>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{t.category}</div>
                                  </div>
                                ))}
                              {tools.filter(t => 
                                t.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                t.category.toLowerCase().includes(searchQuery.toLowerCase())
                              ).length === 0 && (
                                <div style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: "13px" }}>
                                  No matching tools found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {!res.tool_id && (
                          <button
                            onClick={() => {
                              setForm({ tool_name: res.raw_name, category: "", total_quantity: res.quantity, description: "Imported via OCR", unit_price: "" });
                              setView("dashboard"); // Switch back to let them create it
                              window.scrollTo({ top: 400, behavior: "smooth" });
                            }}
                            className="btn-secondary"
                            style={{ fontSize: "12px", padding: "6px 12px", marginBottom: 0 }}
                          >
                            Create New Tool
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const updated = ocrResults.filter((_, i) => i !== idx);
                            setOcrResults(updated);
                          }}
                          className="btn-danger"
                          style={{ 
                            fontSize: "12px", 
                            padding: "6px 12px",
                            borderRadius: "6px",
                            marginBottom: 0
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button onClick={() => setOcrResults([])} className="btn-secondary">Clear Results</button>
                <button
                  onClick={handleBatchStockSubmit}
                  className="btn-primary"
                  style={{ background: "var(--success)", padding: "12px 32px" }}
                >
                  Confirm & Update Inventory
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BEAUTIFUL CUSTOM ALERT POPUP MODAL */}
      {successAlertMessage && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(10, 15, 30, 0.7)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{
            width: "400px",
            padding: "32px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(20, 25, 45, 0.95)"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.2)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              margin: "0 auto 20px auto",
              border: "2px solid var(--success)"
            }}>
              <span style={{ fontSize: "32px" }}>✅</span>
            </div>
            <h3 style={{ marginBottom: "12px", color: "#fff", fontWeight: "600" }}>Notification</h3>
            <p style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "24px", fontSize: "16px", lineHeight: "1.5" }}>
              {successAlertMessage}
            </p>
            <button 
              onClick={handleCloseSuccessAlert} 
              className="btn-primary" 
              style={{ 
                width: "100%", 
                background: "var(--success)", 
                padding: "12px", 
                borderRadius: "8px", 
                fontWeight: "600",
                fontSize: "16px"
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManagerPage;