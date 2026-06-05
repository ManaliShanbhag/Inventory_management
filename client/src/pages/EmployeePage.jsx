import { useEffect, useState, useRef } from "react";

import { getTools } from "../services/toolService";

import DeliveryChallan from "../components/DeliveryChallan";
import { INDIAN_STATES } from "../constants/states";


import {
  createRequest,
  getRequests,
  markAsPrinted,
  deleteRequest
} from "../services/requestService";

import { createReturnRequest, getReturnRequests } from "../services/returnService";


const EmployeePage = ({ user }) => {

  const [tools, setTools] = useState([]);

  const [requests, setRequests] = useState([]);

  const [items, setItems] = useState([]);

  const [view, setView] = useState("dashboard"); // dashboard or returns


  const [searchTerm, setSearchTerm] =
    useState("");

  const [showDropdown, setShowDropdown] =
    useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [selectedDropdownTool,
    setSelectedDropdownTool] =
    useState(null);

  const [selectedApprovedRequest,
    setSelectedApprovedRequest] =
    useState(null);

  // 🔥 DC DETAILS
  const [dcNumber, setDcNumber] =
    useState("");

  const [clientName, setClientName] =
    useState("");

  const [clientAddress,
    setClientAddress] =
    useState("");

  const [attentionPerson,
    setAttentionPerson] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [poNumber, setPoNumber] =
    useState("");

  const [poDate, setPoDate] =
    useState("");

  const [stateName, setStateName] =
    useState("");

  const [returnable, setReturnable] =
    useState(true);

  const [selectedClientDropdown, setSelectedClientDropdown] = useState("");

  // 🔥 HISTORY FILTERS & PAGINATION
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyDate, setHistoryDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [priceInput, setPriceInput] = useState("");
  const [sortColumn, setSortColumn] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const itemsPerPage = 10;

  const [successNotification, setSuccessNotification] = useState("");

  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => {
        setSuccessNotification("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  const filteredHistoryRequests = requests
    .filter((req) => req.user_id === user.id && !req.is_hidden)
    .filter((req) => {
      if (historyStatus !== "all" && req.status !== historyStatus) return false;
      if (historyDate && !req.request_date?.startsWith(historyDate)) return false;
      if (historySearch) {
        const tool = tools.find((t) => t.id === req.tool_id);
        const searchLower = historySearch.toLowerCase();
        const matchesDC = req.dc_number?.toLowerCase().includes(searchLower);
        const matchesTool = tool?.tool_name?.toLowerCase().includes(searchLower);
        return matchesDC || matchesTool;
      }
      return true;
    });

  const groupedHistoryRequests = Object.values(
    filteredHistoryRequests.reduce((acc, req) => {
      const dc = req.dc_number || `N/A`;
      if (!acc[dc]) {
        acc[dc] = {
          dc_number: dc,
          status: req.status,
          request_date: req.request_date,
          items: []
        };
      }
      acc[dc].items.push(req);
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

  const totalHistoryPages = Math.max(1, Math.ceil(groupedHistoryRequests.length / itemsPerPage));
  const paginatedHistoryGroups = groupedHistoryRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 🔥 RETURN STATES
  const [returnSearchDC, setReturnSearchDC] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);



  // 🔥 EXTRACT UNIQUE CLIENTS FOR AUTO-FILL
  const uniqueClients = Array.from(
    new Set(
      requests
        .filter((r) => r.user_id === user.id && r.client_name)
        .map((r) => r.client_name)
    )
  ).map((name) => {
    return requests.find((r) => r.client_name === name && r.user_id === user.id);
  });

  // 🔥 CLEAR FORM
  const handleClearForm = (targetView = view) => {
    setItems([]);
    setSearchTerm("");
    setSelectedDropdownTool(null);
    fetchDCNumber(targetView);
    setClientName("");
    setClientAddress("");
    setAttentionPerson("");
    setPhone("");
    setPoNumber("");
    setPoDate("");
    setStateName("");
    setReturnable(true);
    setSelectedClientDropdown("");
  };

  const handleDeleteRequest = async (id) => {
    if (!id) {
      console.error("Cannot delete request: ID is missing");
      return;
    }
    console.log("Deleting request ID:", id);
    try {
      const res = await deleteRequest(id);
      console.log("Delete response for ID", id, ":", res);
    } catch (err) {
      const msg = err.response?.data || err.message || "Unknown error";
      console.error("Error deleting request:", id, msg);
      throw new Error(msg);
    }
  };



  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  // 🔥 RETURN LOGIC
  const handleSearchReturnDC = async () => {
    if (!returnSearchDC.trim()) return;

    if (returnSearchDC.trim().toUpperCase().startsWith("IN/")) {
      alert("Indents cannot be returned. Please enter a valid Delivery Challan Number.");
      setReturnItems([]);
      return;
    }

    try {
      // 1. Fetch all return requests
      const allReturnReqs = await getReturnRequests();

      // 2. Filter return requests with the same DC Number that are active (pending or approved)
      const activeReturnReqs = allReturnReqs.filter(ret => 
        ret.dc_number?.toLowerCase() === returnSearchDC.toLowerCase() &&
        (ret.status === "pending" || ret.status === "approved")
      );

      // Compile a set of request IDs that have already been returned/restocked
      const alreadyReturnedIds = new Set();
      for (const retReq of activeReturnReqs) {
        const retItems = typeof retReq.items === 'string' ? JSON.parse(retReq.items) : retReq.items;
        if (Array.isArray(retItems)) {
          for (const item of retItems) {
            if (item.returned && item.id) {
              alreadyReturnedIds.add(item.id);
            }
          }
        }
      }

      // 3. Search globally in requests, filtering by matched DC Number and status === 'approved'
      const matched = requests.filter(r => 
        r.dc_number?.toLowerCase() === returnSearchDC.toLowerCase() &&
        r.status === "approved"
      );

      if (matched.length > 0 && matched[0].returnable === false) {
        alert("This is a Non-Returnable Material Indent. Items cannot be returned.");
        setReturnItems([]);
        return;
      }

      if (matched.length === 0) {
        const anyExists = requests.some(r => r.dc_number?.toLowerCase() === returnSearchDC.toLowerCase());
        if (anyExists) {
          alert("This challan number is not yet approved by the manager.");
        } else {
          alert("No challan found with this DC Number");
        }
        setReturnItems([]);
        return;
      }

      // Filter out items that have already been restocked/returned
      const nonRestockedMatched = matched.filter(r => !alreadyReturnedIds.has(r.id));

      if (nonRestockedMatched.length === 0) {
        alert("All items in this challan have already been restocked!");
        setReturnItems([]);
        return;
      }

      // Prepare checklist
      const checklist = nonRestockedMatched.map(r => {
        const tool = tools.find(t => t.id === r.tool_id);
        return {
          ...r,
          tool_name: tool?.tool_name || "Unknown Tool",
          returned: false
        };
      });
      setReturnItems(checklist);

    } catch (err) {
      console.error("Error searching for return challan:", err);
      alert("Error searching for return challan");
    }
  };

  const handleSubmitReturn = async () => {
    if (returnItems.length === 0) return;

    const tickedItems = returnItems.filter(item => item.returned);
    if (tickedItems.length === 0) {
      alert("Please tick at least one item that is being returned.");
      return;
    }

    if (!window.confirm(`Submit return report for ${tickedItems.length} items? This will require manager approval.`)) return;

    setIsSubmittingReturn(true);
    try {
      await createReturnRequest({
        dc_number: returnSearchDC,
        user_id: user.id,
        items: returnItems // We send all, but manager sees who is ticked
      });
      setSuccessNotification("Return report submitted successfully. Waiting for manager approval.");
      setReturnSearchDC("");
      setReturnItems([]);
    } catch (err) {
      console.error(err);
      alert("Error submitting return report");
    } finally {
      setIsSubmittingReturn(false);
    }
  };


  // 🔥 FETCH DATA
  useEffect(() => {
    fetchTools();
    fetchRequests();
    fetchDCNumber();
  }, []);

  async function fetchDCNumber(targetView = view) {
    try {
      const endpoint = targetView === "indent" ? "in-number" : "dc-number";
      const res = await fetch(`http://${window.location.hostname}:5000/api/${endpoint}`);
      const data = await res.json();
      if (data.dcNumber) {
        setDcNumber(data.dcNumber);
      } else if (data.inNumber) {
        setDcNumber(data.inNumber);
      }
    } catch (err) {
      console.error(`Error fetching number for ${targetView}:`, err);
    }
  }

  // 🔥 FETCH TOOLS
  async function fetchTools() {
    try {
      const data = await getTools();
      const sorted = data.sort((a, b) => a.tool_name.localeCompare(b.tool_name));
      setTools(sorted);
    } catch (err) {
      console.error(err);
    }
  }

  // 🔥 FETCH REQUESTS
  async function fetchRequests() {
    try {
      const data = await getRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    }
  }

  // 🔥 HANDLE ITEM CHANGE
  const handleItemChange = (
    index,
    field,
    value
  ) => {

    const updatedItems = [...items];
    updatedItems[index][field] = value;

    // 🔥 AUTO-MULTIPLY PRICE
    if (field === "quantity") {
      const unitPrice = Number(updatedItems[index].unitPrice) || 0;
      updatedItems[index].price = (unitPrice * Number(value)).toFixed(2);
    }

    // 🔥 AUTO-UPDATE PRICE IF UNIT PRICE CHANGES
    if (field === "unitPrice") {
      const qty = Number(updatedItems[index].quantity) || 1;
      updatedItems[index].price = (Number(value) * qty).toFixed(2);
    }

    // 🔥 UPDATE UNIT PRICE IF TOTAL PRICE IS MANUALLY CHANGED
    if (field === "price") {
      const qty = Number(updatedItems[index].quantity) || 1;
      updatedItems[index].unitPrice = (Number(value) / qty).toFixed(2);
    }


    setItems(updatedItems);

  };

  // 🔥 GENERATE INVOICE
  const handleGenerateInvoice = async (req) => {
    // 🔥 APPROVAL CHECK
    if (req.status !== "approved") {
      alert("Manager approval pending");
      return;
    }



    setSelectedApprovedRequest(req);
    // Give React time to update the hidden DeliveryChallan component
    setTimeout(async () => {

      // 🔥 CREATE NEW WINDOW
      const invoiceWindow = window.open("", "_blank", "width=1000,height=900");

      const printContent = document.getElementById("challan-print")?.outerHTML || "";

      // 🔥 RENDER HTML
      invoiceWindow.document.write(`
        <html>
          <head>
            <title>${req.returnable === false ? "Material Indent" : "Delivery Challan"}</title>
            <style>
              body {
                font-family: Arial;
                background: white;
                margin: 0;
                padding: 20px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              table, th, td {
                border: 1px solid black;
              }
              th, td {
                padding: 6px;
                text-align: left;
                font-size: 12px;
              }
              .print-btn {
                margin-top: 20px;
                background: green;
                color: white;
                border: none;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 16px;
              }
              @media print {
                .print-btn {
                  display: none;
                }
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
            <center>
              <button class="print-btn" onclick="window.print()">Print Challan</button>
            </center>
          </body>
        </html>
      `);

      invoiceWindow.document.close();

      // 🔥 MARK AS PRINTED
      try {
        await markAsPrinted(req.id);
        fetchRequests();
      } catch (err) {
        console.error(err);
      }
    }, 150); // 150ms delay for React render
  };

  // 🔥 HANDLE EDIT REQUEST
  const handleEditRequest = (group) => {
    const first = group.items[0];
    setClientName(first.client_name || "");
    setClientAddress(first.client_address || "");
    setAttentionPerson(first.attention_person || "");
    setPhone(first.phone || "");
    setPoNumber(first.po_number || "");
    setPoDate(first.po_date || "");
    setStateName(first.state || "");
    setReturnable(first.returnable);
    setDcNumber(group.dc_number);

    const isExisting = uniqueClients.some(c => c.client_name === first.client_name);
    setSelectedClientDropdown(isExisting ? first.client_name : (first.client_name ? "NEW_CLIENT" : ""));

    const newItems = group.items.map(item => ({
      tool_id: item.tool_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      price: item.price
    }));
    setItems(newItems);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    alert(`Challan ${group.dc_number} data loaded into the form. You can now make changes and submit again.`);
  };



  // 🔥 REQUEST
  const handleRequest = async () => {

    // 🔥 VALIDATION
    if (!dcNumber.trim()) {

      alert(
        "Please enter Delivery Challan Number"
      );

      return;
    }

    if (view !== "indent") {
      if (!clientName.trim()) {
        alert("Please enter client name");
        return;
      }

      if (!clientAddress.trim()) {
        alert("Please enter client address");
        return;
      }

      if (!attentionPerson.trim()) {
        alert("Please enter attention person");
        return;
      }

      if (!phone.trim()) {
        alert("Please enter phone number");
        return;
      }
    }

    if (items.length === 0) {

      alert(
        "Please add tools"
      );

      return;
    }

    // 🔥 VALIDATE ITEMS
    for (const item of items) {

      if (!item.tool_id) {

        alert(
          "Please select all tools"
        );

        return;
      }

      if (
        Number(item.quantity) <= 0
      ) {

        alert(
          "Quantity must be greater than 0"
        );

        return;
      }

      const selectedTool =
        tools.find(
          (t) =>
            t.id ===
            Number(item.tool_id)
        );

      if (!selectedTool) {

        alert(
          "Tool not found"
        );

        return;
      }

      if (
        Number(item.quantity) >
        selectedTool.available_quantity
      ) {

        alert(
          `${selectedTool.tool_name} exceeds available stock`
        );

        return;
      }

    }

    try {
      let finalNumber = dcNumber;
      try {
        const endpoint = view === "indent" ? "in-number" : "dc-number";
        const res = await fetch(`http://${window.location.hostname}:5000/api/${endpoint}`, { method: "POST" });
        const data = await res.json();
        if (data.dcNumber) {
          finalNumber = data.dcNumber;
        } else if (data.inNumber) {
          finalNumber = data.inNumber;
        }
      } catch (err) {
        console.error("Failed to generate final number", err);
      }

      // 🔥 CREATE REQUESTS
      for (const item of items) {

        await createRequest({

          user_id: user.id,

          tool_id:
            Number(item.tool_id),

          quantity:
            Number(item.quantity),

          approved_quantity: 0,

          status: "pending",

          is_printed: false,

          dc_number: finalNumber,

          client_name: view === "indent" ? user.name : clientName,

          client_address:
            view === "indent" ? "Internal Department" : clientAddress,

          attention_person:
            view === "indent" ? user.name : attentionPerson,

          phone: view === "indent" ? "" : phone,

          po_number: poNumber,

          po_date: poDate,

          state: stateName,

          returnable: view === "indent" ? false : returnable,

          price: Number(item.price) || 0,

          unit_price: Number(item.unitPrice) || 0
        });
      }



      setSuccessNotification("Request submitted successfully. Wait for manager approval.");
      handleClearForm();
      fetchRequests();

    } catch (err) {

      console.error(err);

      alert(
        err.response?.data ||
        "Request failed"
      );
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "32px" }}>Employee Dashboard</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => { setView("dashboard"); handleClearForm("dashboard"); }}
            className={view === "dashboard" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "10px 20px", border: "none" }}
          >
            📄 Delivery Challan
          </button>
          <button
            onClick={() => { setView("indent"); handleClearForm("indent"); setReturnable(false); }}
            className={view === "indent" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "10px 20px", background: view === "indent" ? "var(--warning)" : undefined, color: view === "indent" ? "#fff" : undefined, border: "none" }}
          >
            📦 Material Indent
          </button>
          <button
            onClick={() => setView("returns")}
            className={view === "returns" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "10px 20px", background: view === "returns" ? "var(--success)" : undefined, color: view === "returns" ? "#fff" : undefined, border: "none" }}
          >
            🔄 Return Center
          </button>
          <span style={{
            background: "rgba(255,255,255,0.05)",
            padding: "8px 16px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center"
          }}>
            <b>{user.name} ({user.role})</b>
          </span>
        </div>
      </div>

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

      {(view === "dashboard" || view === "indent") && (
        <div className="dashboard-view">
          <div className="dashboard-grid">


            {/* 🔥 TOOL SELECTION */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="glass-panel">
                <h3>Select Tools</h3>

                {/* 🔥 SEARCH */}
                <div ref={dropdownRef}>
                <input
                  type="text"

                  placeholder="Search tool..."

                  value={searchTerm}

                  onChange={(e) => {

                    setSearchTerm(
                      e.target.value
                    );

                    setShowDropdown(true);
                  }}

                  onFocus={() =>
                    setShowDropdown(true)
                  }

                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    marginBottom: "5px"
                  }}
                />

                {/* 🔥 DROPDOWN */}

                {showDropdown && (

                  <div
                    style={{
                      border: "1px solid var(--glass-border)",
                      maxHeight: "220px",
                      overflowY: "auto",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-secondary)",
                      marginBottom: "10px"
                    }}
                  >

                    {tools
                      .filter((tool) =>
                        tool.tool_name
                          .toLowerCase()
                          .includes(
                            searchTerm.toLowerCase()
                          )
                      )

                      .map((tool) => (

                        <div
                          key={tool.id}

                          onClick={() => {
                            setSelectedDropdownTool(tool);
                            setSearchTerm(tool.tool_name);
                            setPriceInput(tool.unit_price || "");
                            setShowDropdown(false);
                          }}

                          style={{
                            padding: "10px",
                            cursor: "pointer",
                            borderBottom:
                              "1px solid rgba(255,255,255,0.1)"
                          }}
                        >

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span>{tool.tool_name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                In Stock: <span style={{ color: tool.available_quantity > 0 ? "var(--success)" : "var(--warning)" }}>{tool.available_quantity}</span>
                              </span>
                            </div>
                            <span style={{ fontSize: "12px", color: "var(--success)" }}>₹{Number(tool.unit_price || 0).toFixed(2)}</span>
                          </div>

                        </div>
                      ))}
                  </div>
                )}
                </div>

                {selectedDropdownTool && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px", marginBottom: "4px" }}>
                    <div>Standard Unit Price: <b style={{ color: "var(--success)" }}>₹{Number(selectedDropdownTool.unit_price || 0).toFixed(2)}</b></div>
                    <div>Available Stock: <b style={{ color: selectedDropdownTool.available_quantity > 0 ? "var(--success)" : "var(--danger)" }}>{selectedDropdownTool.available_quantity}</b></div>
                  </div>
                )}
                <input
                  type="number"
                  placeholder="Price (optional)"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    marginTop: "10px"
                  }}
                />


                {/* 🔥 ADD TOOL */}

                <button
                  onClick={() => {
                    if (!selectedDropdownTool) {
                      alert("Please select a tool");
                      return;
                    }
                    const alreadyExists = items.find((item) => item.tool_id === selectedDropdownTool.id);
                    if (alreadyExists) {
                      alert("Tool already added");
                      return;
                    }
                    const unitPrice = Number(priceInput) || 0;
                    setItems([...items, {
                      tool_id: selectedDropdownTool.id,
                      quantity: 1,
                      unitPrice: unitPrice,
                      price: unitPrice
                    }]);
                    setSearchTerm("");
                    setSelectedDropdownTool(null);
                    setPriceInput("");
                  }}


                  className="btn-primary"
                  style={{ marginTop: "16px", width: "100%" }}
                >
                  Add Tool To Challan
                </button>
              </div>

              {/* 🔥 ITEMS */}


              <div className="glass-panel">
                <h4 style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                  Tools Added: {items.length}
                </h4>

                {items.length > 0 && (
                  <div className="modern-table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Tool Name</th>
                          <th>Unit Price</th>
                          <th>Quantity</th>
                          <th>Total</th>
                          <th>Action</th>
                        </tr>


                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const selectedTool = tools.find((t) => t.id === Number(item.tool_id));
                          if (!selectedTool) return null;

                          return (
                            <tr key={index}>
                              <td>
                                <div style={{ fontWeight: 500 }}>{selectedTool.tool_name}</div>
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                  Available: {selectedTool.available_quantity}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                                  style={{ width: "80px", marginBottom: "0", padding: "8px" }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  max={selectedTool.available_quantity}
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                  style={{ width: "60px", marginBottom: "0", padding: "8px" }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => handleItemChange(index, "price", e.target.value)}
                                  style={{ width: "100px", marginBottom: "0", padding: "8px" }}
                                />
                              </td>


                              <td>
                                <button
                                  onClick={() => {
                                    const updated = items.filter((_, i) => i !== index);
                                    setItems(updated);
                                  }}
                                  className="btn-danger"
                                  style={{ padding: "6px 12px", fontSize: "12px" }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 🔥 DELIVERY DETAILS */}
            <div className="glass-panel">

              <h3>{view === "indent" ? "Material Indent Details" : "Delivery Challan Details"}</h3>

              {view !== "indent" ? (
                <>
                  <select
                    value={selectedClientDropdown}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedClientDropdown(val);
                      if (val === "NEW_CLIENT") {
                        setClientName("");
                        setClientAddress("");
                        setAttentionPerson("");
                        setPhone("");
                        setStateName("");
                      } else {
                        const client = uniqueClients.find(c => c.client_name === val);
                        if (client) {
                          setClientName(client.client_name || "");
                          setClientAddress(client.client_address || "");
                          setAttentionPerson(client.attention_person || "");
                          setPhone(client.phone || "");
                          setStateName(client.state || "");
                        } else {
                          setClientName("");
                          setClientAddress("");
                          setAttentionPerson("");
                          setPhone("");
                          setStateName("");
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
                  >
                    <option value="">-- Select Existing Client --</option>
                    <option value="NEW_CLIENT">+ Add New Client (Manual Entry)</option>
                    {uniqueClients.map((client, idx) => (
                      <option key={idx} value={client.client_name}>{client.client_name}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Generating DC Number..."
                    value={dcNumber}
                    readOnly
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px",
                      backgroundColor: "#e9ecef",
                      cursor: "not-allowed",
                      fontWeight: "bold",
                      color: "#495057",
                      boxSizing: "border-box"
                    }}
                  />

                  <input
                    type="text"
                    placeholder="Client Name"
                    value={clientName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientName(val);
                      const exists = uniqueClients.some(c => c.client_name === val);
                      setSelectedClientDropdown(exists ? val : (val === "" ? "" : "NEW_CLIENT"));
                    }}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />

                  <textarea
                    placeholder="Client Address"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows="4"
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />

                  <input
                    type="text"
                    placeholder="Attention Person"
                    value={attentionPerson}
                    onChange={(e) => setAttentionPerson(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />

                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--text-secondary)", fontSize: "12px" }}>Indent Number</p>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "16px", color: "var(--accent-primary)" }}>{dcNumber}</p>
                  </div>
                  <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                    <p style={{ margin: "0 0 8px 0", color: "var(--text-secondary)", fontSize: "12px" }}>Requested By</p>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>{user?.name}</p>
                  </div>
                </>
              )}

              {view !== "indent" && (
                <>
                  <input
                    type="text"
                    placeholder="PO Number"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />

                  <input
                    type="date"
                    placeholder="PO Date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginBottom: "10px"
                    }}
                  />

                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-color)"
                    }}
                  >
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </>
              )}


              <label
                style={{
                  display: view === "indent" ? "none" : "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "20px"
                }}
              >
                <input
                  type="checkbox"
                  checked={returnable}
                  onChange={() =>
                    setReturnable(
                      !returnable
                    )
                  }
                />
                Returnable
              </label>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleRequest}
                  className="btn-primary"
                  style={{ padding: "10px 16px" }}
                >
                  Submit Request
                </button>

                <button
                  onClick={handleClearForm}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div> {/* End dashboard-grid */}

          {/* 🔥 REQUEST HISTORY */}
          <div className="glass-panel" style={{ marginTop: "32px" }}>

            <h2>My Request History</h2>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <input
                type="text"
                placeholder="Search by DC Number or Tool Name"
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setCurrentPage(1); }}
                style={{ padding: "8px", flex: 1 }}
              />
              <input
                type="date"
                value={historyDate}
                onChange={(e) => { setHistoryDate(e.target.value); setCurrentPage(1); }}
                style={{ padding: "8px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--glass-border)", borderRadius: "4px" }}
              />
              <select
                value={historyStatus}
                onChange={(e) => { setHistoryStatus(e.target.value); setCurrentPage(1); }}
                style={{ padding: "8px" }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="modern-table-container">
              <table>

                <thead>
                  <tr>
                    <th onClick={() => handleSort("dc")} style={{ cursor: "pointer", userSelect: "none" }}>
                      DC Number {sortColumn === "dc" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>

                    <th>Tool</th>

                    <th onClick={() => handleSort("status")} style={{ cursor: "pointer", userSelect: "none" }}>
                      Status {sortColumn === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {paginatedHistoryGroups.map((group) => {
                    const firstReq = group.items[0];

                    return (
                      <tr key={group.dc_number}>
                        <td>
                          <span style={{ fontWeight: "bold", color: "var(--accent-primary)" }}>
                            {group.dc_number}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {group.items.map((item, idx) => {
                              const tool = tools.find((t) => t.id === item.tool_id);
                              return (
                                <div key={idx} style={{ fontSize: "12px", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                                  {tool?.tool_name} <span style={{ color: "var(--text-secondary)", marginLeft: "4px" }}>x {item.quantity}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${group.status}`} style={{ minWidth: "80px", textAlign: "center" }}>
                            {group.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {group.status === "approved" && (
                              <button
                                onClick={() => handleGenerateInvoice(firstReq)}
                                className="btn-success"
                                style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                              >
                                {firstReq?.returnable === false ? "Print Indent" : "Generate Invoice"}
                              </button>
                            )}

                            {group.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleEditRequest(group)}
                                  className="btn-primary"
                                  style={{ padding: "6px 12px", fontSize: "12px" }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm("Cancel this entire challan?")) {
                                      try {
                                        for (const item of group.items) {
                                          await handleDeleteRequest(item.id);
                                        }
                                        alert("Challan cancelled successfully");
                                        setTimeout(() => { fetchRequests(); }, 300);
                                      } catch (err) {
                                        alert(`Error cancelling requests: ${err.message}`);
                                      }
                                    }
                                  }}
                                  className="btn-danger"
                                  style={{ padding: "6px 12px", fontSize: "12px" }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 🔥 PAGINATION CONTROLS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="btn-secondary"
                style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ color: "var(--text-secondary)" }}>Page {currentPage}</span>
              <button
                disabled={currentPage >= totalHistoryPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="btn-secondary"
                style={{ opacity: currentPage >= totalHistoryPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 HIDDEN CHALLAN TEMPLATE */}
      <div style={{ display: "none" }}>
        <DeliveryChallan
          dcNumber={selectedApprovedRequest?.dc_number}
          clientName={selectedApprovedRequest?.client_name}
          clientAddress={selectedApprovedRequest?.client_address}
          attentionPerson={selectedApprovedRequest?.attention_person}
          phone={selectedApprovedRequest?.phone}
          poNumber={selectedApprovedRequest?.po_number}
          poDate={selectedApprovedRequest?.po_date}
          stateName={selectedApprovedRequest?.state}
          returnable={selectedApprovedRequest?.returnable}
          items={
            selectedApprovedRequest
              ? requests
                .filter((r) => r.dc_number === selectedApprovedRequest.dc_number && r.status === "approved" && r.user_id === user.id)
                .map((r) => ({
                  tool_id: r.tool_id,
                  quantity: r.approved_quantity || r.quantity,
                  price: r.price,
                  unitPrice: r.unit_price
                }))
              : []
          }
          tools={tools}
          employeeName={user?.name}
        />
      </div>


      {view === "returns" && (
        <div className="glass-panel" style={{ marginTop: "32px" }}>
          <h3>Process Return (Inward)</h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Enter the DC Number and tick the items that have been returned.
          </p>

          <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
            <input
              type="text"
              placeholder="Enter DC Number (e.g. DC/2026-27/001)"
              value={returnSearchDC}
              onChange={(e) => setReturnSearchDC(e.target.value)}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button onClick={handleSearchReturnDC} className="btn-primary" style={{ padding: "12px 24px" }}>
              Find Challan
            </button>
          </div>

          {returnItems.length > 0 && (
            <div className="modern-table-container">
              <table style={{ marginBottom: "24px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>Tick</th>
                    <th>Item Name</th>
                    <th>Sent Qty</th>
                    <th>Original DC</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.returned}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].returned = e.target.checked;
                            setReturnItems(updated);
                          }}
                          style={{ width: "20px", height: "20px", cursor: "pointer" }}
                        />
                      </td>
                      <td>{item.tool_name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.dc_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSubmitReturn}
                  disabled={isSubmittingReturn}
                  className="btn-primary"
                  style={{ background: "var(--success)", padding: "12px 32px" }}
                >
                  {isSubmittingReturn ? "Submitting..." : "Submit Return Report"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default EmployeePage;