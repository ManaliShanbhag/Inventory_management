import React from "react";
import DeliveryForm from "./DeliveryForm";
import logo from "../assets/armtronix-logo1.png";



const DeliveryChallan = ({
  dcNumber,
  clientName,
  clientAddress,
  attentionPerson,
  phone,
  poNumber,
  poDate,
  stateName,
  returnable,
  items,
  tools,
  employeeName
}) => {
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);


  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  return (

    <div
      id="challan-print"

      style={{
        width: "210mm",
        height: "297mm",
        margin: "auto",
        background: "white",
        padding: "4mm",
        border: "1px solid #ccc",
        fontFamily: "Orbitron",
        fontSize: "11px",
        color: "#333",
        pageBreakInside: "avoid",
        boxSizing: "border-box",

        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div>



        {/* 🔥 HEADER LOGO */}

        {/* 🔥 HEADER */}

        {/* 🔥 HEADER LOGO */}

        <div
          style={{
            width: "99.9%",
            marginBottom: "4px",
            backgroundColor: "#c41111ff",
            overflow: "hidden",
            boxSizing: "border-box",

            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",

            padding: "0 10px",

            height: "60px"
          }}
        >

          {/* 🔥 LOGO LEFT */}

          <img
            src={logo}

            alt="Armtronix Logo"

            style={{
              width: "70%",
              height: "55px",

              display: "block",

              objectFit: "contain",

              objectPosition: "left"
            }}
          />

          {/* 🔥 WEBSITE RIGHT */}

          <p
            style={{
              color: "white",

              fontWeight: "bold",

              fontSize: "18px",

              margin: 0,

              whiteSpace: "nowrap"
            }}
          >
            www.armtronix.in
          </p>

        </div>
        {/* 🔥 JURISDICTION */}

        <p
          style={{
            textAlign: "center",
            fontSize: "10px",
            fontWeight: "bold",
            margin: "2px 0 4px 0"
          }}
        >
          SUBJECTED TO HUBBALLI JURIDICTION
        </p>

        {/* 🔥 CONDITIONAL BIG TITLE */}
        {!returnable && (
          <h2 style={{ textAlign: "center", margin: "10px 0", letterSpacing: "2px", textDecoration: "underline" }}>
            MATERIAL INDENT
          </h2>
        )}

        {/* 🔥 RETURNABLE (Only for Challan) */}
        {returnable && (
          <div
            style={{
              border: "1px solid black",
              padding: "4px",
              fontSize: "10px",
              marginBottom: "4px"
            }}
          >

            <label>
              <input
                type="checkbox"
                checked={returnable}
                readOnly
              />

              {" "}Returnable
            </label>

            <label
              style={{
                marginLeft: "20px"
              }}
            >
              <input
                type="checkbox"
                checked={!returnable}
                readOnly
              />

              {" "}Non-Returnable
            </label>
          </div>
        )}

        {/* 🔥 FROM TO */}

        <div
          style={{
            display: "flex",
            border: "1px solid black",
            fontSize: "10px",
            lineHeight: "1.1"
          }}
        >

          {/* 🔥 FROM */}

          <div
            style={{
              width: "50%",
              borderRight:
                "1px solid black",

              padding: "5px",

              minHeight: "120px"
            }}
          >

            <h4
              style={{
                margin: "0 0 3px 0"
              }}
            >
              From
            </h4>

            <p style={{ margin: "1px 0" }}>
              <strong>
                Armtronix IoT Pvt. Ltd.
              </strong>
            </p>

            <p style={{ margin: "1px 0" }}>
              KLE Tech Park Building,
              KLE Technological University,
              Vidyanagar,
              Hubballi,
              Karnataka-580031
            </p>

            <p style={{ margin: "1px 0" }}>
              GSTIN:
              29AAVCA5913E1ZD
            </p>

            <p style={{ margin: "1px 0" }}>
              PAN:
              AAVCA5913E
            </p>

            <br />

            <p style={{ margin: "1px 0" }}>
              <strong>
                {!returnable ? "Indent No:" : "DC No:"}
              </strong>{" "}

              {dcNumber}
            </p>

            <p style={{ margin: "1px 0" }}>
              <strong>
                Date:
              </strong>{" "}

              {formatDate(new Date())}
            </p>

            {returnable && (
              <>
                <p style={{ margin: "1px 0" }}>
                  <strong>
                    PO #:
                  </strong>{" "}

                  {poNumber}
                </p>

                <p style={{ margin: "1px 0" }}>
                  <strong>
                    PO Date:
                  </strong>{" "}

                  {formatDate(poDate)}
                </p>

                <p style={{ margin: "1px 0" }}>
                  <strong>
                    State:
                  </strong>{" "}

                  {stateName}
                </p>
              </>
            )}
          </div>

          {/* 🔥 TO */}

          <div
            style={{
              width: "49.95%",
              padding: "5px",
              minHeight: "120px"
            }}
          >

            <h4
              style={{
                margin: "0 0 3px 0"
              }}
            >
              To
            </h4>

            {!returnable ? (
              <>
                <p style={{ margin: "1px 0", fontSize: "14px", marginTop: "10px" }}>
                  <strong>Internal Department / Employee</strong>
                </p>
                <p style={{ margin: "1px 0", fontSize: "14px", marginTop: "10px" }}>
                  Name: <strong>{employeeName || clientName}</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: "1px 0" }}>
                  <strong>
                    {clientName}
                  </strong>
                </p>

                <p style={{ margin: "1px 0" }}>
                  {clientAddress}
                </p>

                <p style={{ margin: "1px 0" }}>
                  Kind Attn:
                  {" "}
                  {attentionPerson}
                </p>

                <p style={{ margin: "1px 0" }}>
                  Phone:
                  {" "}
                  {phone}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 🔥 TABLE */}

        <table
          border="1"

          cellPadding="4"

          style={{
            width: "99.9%",
            borderCollapse:
              "collapse",
            marginTop: "6px",
            fontSize: "10px"
          }}
        >

          <thead>

            <tr>

              <th
                style={{
                  width: "10%"
                }}
              >
                S.No
              </th>

              <th>
                Description of Goods
              </th>

              <th style={{ width: "10%" }}>
                Qty
              </th>

              <th style={{ width: "15%" }}>
                Unit Price
              </th>

              <th style={{ width: "15%" }}>
                Total Price
              </th>



            </tr>

          </thead>

          <tbody>

            {items.map(
              (item, index) => {

                const tool =
                  tools.find(
                    (t) =>
                      t.id ===
                      item.tool_id
                  );

                return (

                  <tr key={index}>

                    <td>
                      {index + 1}
                    </td>

                    <td>
                      {
                        tool?.tool_name
                      }
                    </td>

                    <td>
                      {
                        item.quantity
                      }
                    </td>

                    <td>
                      {
                        item.unitPrice || (item.price && item.quantity ? (Number(item.price) / Number(item.quantity)).toFixed(2) : 0)
                      }
                    </td>


                    <td>
                      {
                        item.price || 0
                      }
                    </td>



                  </tr>
                );
              }
            )}

            {/* 🔥 EMPTY ROWS */}

            {Array.from({
              length:
                5 - items.length > 0
                  ? 5 - items.length
                  : 0
            }).map((_, i) => (

              <tr key={i}>
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>


            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2" style={{ textAlign: "left", fontWeight: "bold" }}>
                Total
              </td>

              <td style={{ fontWeight: "bold" }}>
                {totalQuantity}
              </td>

              <td style={{ fontWeight: "bold" }}>
              </td>

              <td style={{ fontWeight: "bold" }}>
                {totalAmount.toFixed(2)}
              </td>
            </tr>

          </tfoot>
        </table>

        {/* 🔥 REMARKS */}

        <div
          style={{
            border: "1px solid black",
            height: "55px",
            marginTop: "6px",
            padding: "4px",
            fontSize: "10px",
            width: "98.%",
          }}
        >

          <strong>
            Remarks:
          </strong>
        </div>

      </div>

      {/* 🔥 BOTTOM SECTION WRAPPER */}
      <div>
        {/* 🔥 SIGNATURE */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "10px",
            width: "99.9%",
          }}
        >

          <div
            style={{
              border: "1px solid black",
              width: "280px",
              height: "80px",
              textAlign: "center",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: "10px",
              fontSize: "12px",
              fontWeight: "bold",
              boxSizing: "border-box"
            }}
          >
            Authorized Signatory
          </div>
        </div>

        {/* 🔥 FOOTER */}

        <div
          style={{
            backgroundColor: "#d60000",
            color: "white",
            marginTop: "10px",
            padding: "5px",
            textAlign: "center",
            fontSize: "9px"
          }}
        >

          Ground Floor,
          KLE Tech Park Building,
          KLE Technological University,
          VIDYANAGAR,
          Hubli Karnataka 580031

          <br />

          Call:
          +91 98803 10042

          {" | "}

          Mail:
          armtronix2021@gmail.com
        </div>
      </div>

    </div>
  );
};

export default DeliveryChallan;