# Tool Inventory Management System

A modern, full-stack Tool Inventory Management web application designed to streamline company tool allocations, employee requests, returns, and automatic stock inward processes via OCR invoice parsing. It features dedicated portals for **Managers** and **Employees**, complete with live stock tracking and printable Delivery Challans (DC).

---

## 🚀 Key Features

### 👤 Role-Based Portals & Authentication
* **Manager Dashboard:** 
  * Full dashboard to monitor pending, approved, and rejected requests.
  * Real-time stock management (add, edit, delete, and track total vs. available quantities).
  * OCR-powered stock inward tool to parse and ingest details directly from PDF/Image invoices.
  * Approve tool returns and manage employee allocations.
* **Employee Portal:**
  * Request multiple tools simultaneously with live stock verification.
  * Real-time unit price check to see the cost of tools before submitting.
  * Easy-to-use return submission interface to log return requests for tools in their possession.

### 📄 Delivery Challan (DC) System
* **Sequential DC Generator:** Generates unique, financial-year adjusted delivery challan numbers (e.g., `DC/2026-27/001`).
* **Printable Invoices:** Elegant, print-friendly Delivery Challan sheets ready for physical signatures and filing.

---

## 🛠️ Technology Stack

* **Frontend:** React.js, Vite, Vanilla CSS (Modern aesthetic, responsive grids)
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (with `pg` connection pooling)
* **OCR Service:** Integrated OCR parsing for automated stock inward processing (Tesseract/custom parser helper)

---

## 📦 Project Structure

```text
├── client/                 # React Frontend (Vite)
│   ├── src/                # Component logic, views, context
│   └── package.json        # Frontend dependencies
├── server/                 # Node.js/Express Backend
│   ├── config/             # Database connection configurations
│   ├── controllers/        # Request handling and business logic
│   ├── routes/             # REST API endpoints
│   └── package.json        # Backend dependencies
├── schema.sql              # Database schema (tables structure)
└── .gitignore              # Files ignored by git
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v16+ recommended)
* [PostgreSQL](https://www.postgresql.org/) database server

### 2. Database Initialization
1. Create a database called `inventory_db` in PostgreSQL.
2. Run the `schema.sql` script to set up all tables, relations, and initial states:
   ```bash
   PGPASSWORD=your_db_password psql -h localhost -U postgres -d inventory_db -f schema.sql
   ```
3. Seed the database with users and tool inventory:
   ```bash
   # From the project root:
   node server/seedUsers.js
   node server/importTools.js
   ```

### 3. Backend Setup
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your database connection in `server/config/db.js` (or set up a `.env` file).
4. Start the server:
   ```bash
   npm start
   ```
   *The server runs by default on `http://localhost:5000`.*

### 4. Frontend Setup
1. Navigate to the client folder:
   ```bash
   cd ../client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The client runs by default on `http://localhost:5173`.*

---

## 🔒 Security Recommendations
* Use environment variables (`.env`) to store database passwords and session secrets.
* Make sure `node_modules`, log files, and `.env` remain in the `.gitignore` so they are not committed to GitHub.
