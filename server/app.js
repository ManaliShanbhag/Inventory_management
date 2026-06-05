const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

const REQUEST_COLUMNS = {
  approved_quantity: 'INTEGER DEFAULT 0',
  is_printed: 'BOOLEAN DEFAULT false',
  dc_number: 'TEXT',
  client_name: 'TEXT',
  client_address: 'TEXT',
  attention_person: 'TEXT',
  phone: 'TEXT',
  po_number: 'TEXT',
  po_date: 'DATE',
  state: 'TEXT',
  returnable: 'BOOLEAN DEFAULT true',
  is_hidden: 'BOOLEAN DEFAULT false',
  price: 'DECIMAL(10,2) DEFAULT 0',
  unit_price: 'DECIMAL(10,2) DEFAULT 0'
};



const ensureRequestColumns = async () => {
  try {
    const tableRes = await pool.query(
      `SELECT to_regclass('public.requests') AS exists`
    );

    if (!tableRes.rows[0].exists) {
      console.warn('Requests table does not exist, skipping request schema check.');
      return;
    }

    for (const [column, type] of Object.entries(REQUEST_COLUMNS)) {
      const res = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'requests' AND column_name = $1`,
        [column]
      );

      if (res.rows.length === 0) {
        console.log(`Adding missing request column: ${column} ${type}`);
        await pool.query(`ALTER TABLE requests ADD COLUMN ${column} ${type}`);
      }
    }
  } catch (err) {
    console.error('Error ensuring request columns:', err.message || err);
  }
};

ensureRequestColumns();
 
 const ensureReturnRequestsTable = async () => {
   try {
     await pool.query(`
       CREATE TABLE IF NOT EXISTS return_requests (
         id SERIAL PRIMARY KEY,
         dc_number TEXT,
         user_id INTEGER REFERENCES users(id),
         items JSONB,
         status TEXT DEFAULT 'pending',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )
     `);
     console.log('Return requests table ensured.');
   } catch (err) {
     console.error('Error ensuring return requests table:', err.message || err);
   }
 };
 
 ensureReturnRequestsTable();


const ensureAllocationsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS allocations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        tool_id INTEGER,
        quantity INTEGER,
        allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Allocations table ensured.");
  } catch (err) {
    console.error('Error ensuring allocations table:', err.message || err);
  }
};
ensureAllocationsTable();

const ensureDCSequenceTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dc_sequence (
        id SERIAL PRIMARY KEY,
        last_number INTEGER DEFAULT 0
      )
    `);
    const res = await pool.query('SELECT COUNT(*) FROM dc_sequence');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query('INSERT INTO dc_sequence (last_number) VALUES (0)');
    }
  } catch (err) {
    console.error('Error ensuring dc_sequence table:', err);
  }
};
ensureDCSequenceTable();

const ensureINSequenceTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS in_sequence (
        id SERIAL PRIMARY KEY,
        last_number INTEGER DEFAULT 0
      )
    `);
    const res = await pool.query('SELECT COUNT(*) FROM in_sequence');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query('INSERT INTO in_sequence (last_number) VALUES (0)');
    }
  } catch (err) {
    console.error('Error ensuring in_sequence table:', err);
  }
};
ensureINSequenceTable();

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);



// 🔥 DEBUG
console.log("APP LOADED");

// ✅ ROOT TEST
app.get('/', (req, res) => {
  res.send('API Running');
});

// ✅ DB TEST
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('DB error');
  }
});

// ✅ HEALTH CHECK
app.get('/check', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ✅ GET DYNAMIC DC NUMBER (PREVIEW)
app.get('/api/dc-number', async (req, res) => {
  try {
    const result = await pool.query('SELECT last_number + 1 AS next_number FROM dc_sequence');
    const nextNumber = result.rows[0].next_number;
    
    const date = new Date();
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth(); // 0-indexed, 3 is April
    
    let fyStart, fyEnd;
    if (currentMonth >= 3) {
      fyStart = currentYear;
      fyEnd = currentYear + 1;
    } else {
      fyStart = currentYear - 1;
      fyEnd = currentYear;
    }
    
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;
    const formatted = `DC/${fyString}/${String(nextNumber).padStart(3, '0')}`;
    
    res.json({ dcNumber: formatted });
  } catch (err) {
    console.error('Error getting DC number preview:', err);
    res.status(500).json({ error: 'Failed to preview DC number' });
  }
});

// ✅ GENERATE DYNAMIC DC NUMBER (ON SUBMIT)
app.post('/api/dc-number', async (req, res) => {
  try {
    const result = await pool.query('UPDATE dc_sequence SET last_number = last_number + 1 RETURNING last_number');
    const nextNumber = result.rows[0].last_number;
    
    const date = new Date();
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth(); // 0-indexed, 3 is April
    
    let fyStart, fyEnd;
    if (currentMonth >= 3) {
      fyStart = currentYear;
      fyEnd = currentYear + 1;
    } else {
      fyStart = currentYear - 1;
      fyEnd = currentYear;
    }
    
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;
    const formatted = `DC/${fyString}/${String(nextNumber).padStart(3, '0')}`;
    
    res.json({ dcNumber: formatted });
  } catch (err) {
    console.error('Error generating DC number:', err);
    res.status(500).json({ error: 'Failed to generate DC number' });
  }
});

// ✅ GET DYNAMIC IN NUMBER (PREVIEW)
app.get('/api/in-number', async (req, res) => {
  try {
    const result = await pool.query('SELECT last_number + 1 AS next_number FROM in_sequence');
    const nextNumber = result.rows[0].next_number;
    
    const date = new Date();
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth(); // 0-indexed, 3 is April
    
    let fyStart, fyEnd;
    if (currentMonth >= 3) {
      fyStart = currentYear;
      fyEnd = currentYear + 1;
    } else {
      fyStart = currentYear - 1;
      fyEnd = currentYear;
    }
    
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;
    const formatted = `IN/${fyString}/${String(nextNumber).padStart(2, '0')}`;
    
    res.json({ inNumber: formatted });
  } catch (err) {
    console.error('Error getting IN number preview:', err);
    res.status(500).json({ error: 'Failed to preview IN number' });
  }
});

// ✅ GENERATE DYNAMIC IN NUMBER (ON SUBMIT)
app.post('/api/in-number', async (req, res) => {
  try {
    const result = await pool.query('UPDATE in_sequence SET last_number = last_number + 1 RETURNING last_number');
    const nextNumber = result.rows[0].last_number;
    
    const date = new Date();
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth(); // 0-indexed, 3 is April
    
    let fyStart, fyEnd;
    if (currentMonth >= 3) {
      fyStart = currentYear;
      fyEnd = currentYear + 1;
    } else {
      fyStart = currentYear - 1;
      fyEnd = currentYear;
    }
    
    const fyString = `${fyStart}-${String(fyEnd).slice(-2)}`;
    const formatted = `IN/${fyString}/${String(nextNumber).padStart(2, '0')}`;
    
    res.json({ inNumber: formatted });
  } catch (err) {
    console.error('Error generating IN number:', err);
    res.status(500).json({ error: 'Failed to generate IN number' });
  }
});

// 🔥 IMPORT ROUTES
const toolRoutes = require('./routes/toolRoutes');
const requestRoutes = require('./routes/requestRoutes');
const returnRoutes = require('./routes/returnRoutes');


// 🔥 USE ROUTES
app.use('/api/tools', toolRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/returns', returnRoutes);


module.exports = app;