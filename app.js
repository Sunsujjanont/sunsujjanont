const { count } = require('console');
const express = require('express');
const app = express();
const port = 4000;

// ตั้งค่า EJS เป็น template engine
app.set('view engine', 'ejs');
app.set('views', './views'); // บอก Express ว่าไฟล์ EJS อยู่ในโฟลเดอร์ 'views'

// Middleware สำหรับการ parse JSON body ใน request (สำหรับ API)
app.use(express.json());
// Middleware สำหรับการ parse URL-encoded body (สำหรับ form submissions)
app.use(express.urlencoded({ extended: true }));
// Middleware สำหรับ serving static files (CSS, JS, images)
app.use(express.static('public'));

// --- ตัวอย่างข้อมูลอาหารและออเดอร์ (เก็บในหน่วยความจำชั่วคราว) ---
let nextOrderId = 1;
const orders = [];
const menu = [
    { id: 101, name: 'ผัดกะเพราไก่ไข่ดาว', price: 60, image: '/images/pad-krapao.jpg' },
    { id: 102, name: 'ข้าวผัดหมู', price: 55, image: '/images/fried-rice.jpg' },
    { id: 103, name: 'ส้มตำไทย', price: 70, image: '/images/som-tum.jpg' },
    { id: 104, name: 'ต้มยำกุ้งน้ำข้น', price: 120, image: '/images/tom-yam.jpg' }
];

// เพิ่มรูปภาพ placeholder หากไม่มีรูปภาพจริง
// เพื่อให้แน่ใจว่าหน้าเว็บแสดงผลได้โดยไม่ error
menu.forEach(item => {
    if (!item.image) {
        item.image = 'https://via.placeholder.com/150'; // Placeholder image URL
    }
});


// --- Routes สำหรับหน้าเว็บ (Web Pages) ---

// GET / - หน้าแรก (แสดงเมนูและฟอร์มสั่งอาหาร)
app.get('/', (req, res) => {
    res.render('index', { menu: menu }); // ส่งข้อมูลเมนูไปให้ EJS template
});

// POST /submit-order - รับข้อมูลฟอร์มการสั่งอาหาร
app.post('/submit-order', (req, res) => {
    const { customerName, deliveryAddress, items } = req.body;
    console.log('req.body', req.body);
    if (!deliveryAddress || !items || Object.keys(items).length === 0) {
        return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วนและเลือกรายการอาหาร');
    }

    let totalAmount = 0;
    const orderedItems = [];

    // 'items' จาก form จะมาในรูปแบบ { '101': '2', '103': '1' }
    for (const menuId in items) {
        const quantity = parseInt(items[menuId]); // แปลงเป็นตัวเลข
        if (quantity > 0) {
            const menuItem = menu.find(m => m.id === parseInt(menuId));
            if (menuItem) {
                orderedItems.push({
                    menuId: menuItem.id,
                    name: menuItem.name,
                    price: menuItem.price,
                    quantity: quantity,
                    subtotal: menuItem.price * quantity
                });
                totalAmount += menuItem.price * quantity;
            }
            const newOrder = {
              orderId: menuItem.id, //'ORD001',
              customerName: 'โต๊ะ' + deliveryAddress,//'นายสมชาย ใจดี',
              productName: menuItem.name, //'เสื้อยืดสีดำ',
              quantity: quantity, //2,
              price: totalAmount,//350.00,
              orderDate: new Date().toISOString().split('T')[0], // วันที่ปัจจุบัน YYYY-MM-DD
              status: 'Pending'
            };

            main(newOrder);
        }
    }

    if (orderedItems.length === 0) {
        return res.status(400).send('กรุณาเลือกจำนวนอาหารอย่างน้อย 1 รายการ');
    }

    const newOrder = {
        id:null,//id: nextOrderId++,
        customerName: customerName,
        items: orderedItems,
        totalAmount: totalAmount,
        deliveryAddress: deliveryAddress,
        status: 'pending',
        orderDate: new Date().toISOString()
    };

    orders.push(newOrder);

    // แสดงหน้ายืนยันการสั่งซื้อ
    res.render('index', { menu: menu });
    //res.render('order-confirmation', { order: newOrder });
});

// --- API Endpoints (เผื่อต้องการใช้ AJAX หรือ Mobile App ในอนาคต) ---

// GET /api/menu - ดูรายการอาหารทั้งหมด (API)
app.get('/api/menu', (req, res) => {
    res.status(200).json({
        message: 'รายการอาหารทั้งหมด (API)',
        menu: menu
    });
});

// GET /api/orders - ดูรายการออเดอร์ทั้งหมด (API)
app.get('/api/orders', (req, res) => {
    res.status(200).json({
        message: 'รายการออเดอร์ทั้งหมด (API)',
        orders: orders
    });
});

// POST /api/orders - สร้างออเดอร์ใหม่ (API)
app.post('/api/orders', (req, res) => {
    const { customerName, items, deliveryAddress } = req.body;

    if (!items || items.length === 0 || !deliveryAddress) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน: items, และ deliveryAddress' });
    }

    let totalAmount = 0;
    const orderedItems = [];

    for (const item of items) {
        const menuItem = menu.find(m => m.id === item.menuId);
        if (!menuItem) {
            return res.status(404).json({ message: `ไม่พบรายการอาหาร ID: ${item.menuId}` });
        }
        if (item.quantity <= 0) {
             return res.status(400).json({ message: `จำนวนสินค้าสำหรับ ID ${item.menuId} ต้องมากกว่า 0` });
        }
        orderedItems.push({
            menuId:null,//menuId: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: item.quantity,
            subtotal: menuItem.price * item.quantity
        });
        totalAmount += menuItem.price * item.quantity;
    }

    const newOrder = {
        id:null,//id: nextOrderId++,
        customerName: customerName,
        items: orderedItems,
        totalAmount: totalAmount,
        deliveryAddress: deliveryAddress,
        status: 'pending',
        orderDate: new Date().toISOString()
    };

    orders.push(newOrder);

    res.status(201).json({
        message: 'รับออเดอร์เรียบร้อยแล้ว (API)!',
        order: newOrder
    });
});


const { google } = require('googleapis');
const path = require('path');

// ตั้งค่า Service Account Key
// ตรวจสอบให้แน่ใจว่าไฟล์ credentials.json อยู่ในตำแหน่งที่ถูกต้อง
const KEYFILEPATH = path.join(__dirname, 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Spreadsheet ID ของ Google Sheet ของคุณ
const SPREADSHEET_ID = '1Z7WYwswP16WM23ILYcvhzNpieDNO6cQj0h3Wv1xFrUE'; // *** เปลี่ยนเป็น Spreadsheet ID ของคุณ ***

async function appendOrderToSheet(orderData) {
  try {
    // สร้าง JWT client สำหรับการยืนยันตัวตนด้วย Service Account
    const auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ข้อมูลที่จะบันทึก (array of arrays)
    // แต่ละ inner array คือ 1 แถวใน Google Sheet
    const values = [
      [
        null,//orderData.orderId,
        orderData.customerName,
        orderData.productName,
        orderData.quantity,
        orderData.price,
        orderData.orderDate,
        orderData.status
      ]
    ];

    const resource = {
      values,
    };

    // กำหนดช่วง (range) ที่จะเพิ่มข้อมูล
    // เช่น 'Sheet1!A:G' จะเป็นการเพิ่มข้อมูลต่อจากแถวสุดท้ายในคอลัมน์ A ถึง G ของ Sheet1
    const range = 'Sheet1!A:G'; // *** เปลี่ยนเป็นชื่อ Sheet และช่วงคอลัมน์ที่คุณต้องการ ***
//    console.log('range:', range);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED', // หรือ RAW
      resource: resource,
    });

//    console.log('Order appended successfully:', response.data);
    return response.data;

  } catch (error) {
    console.error('Error appending order to Google Sheet:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// ตัวอย่างการเรียกใช้ฟังก์ชัน
async function main(newOrder) {
  /*
  const newOrder = {
    orderId: 'ORD001',
    customerName: 'นายสมชาย ใจดี',
    productName: 'เสื้อยืดสีดำ',
    quantity: 2,
    price: 350.00,
    orderDate: new Date().toISOString().split('T')[0], // วันที่ปัจจุบัน YYYY-MM-DD
    status: 'Pending'
  };
  */
  try {
    await appendOrderToSheet(newOrder);
    console.log('Process completed.');
  } catch (error) {
    console.error('Failed to append order:', error);
  }
}

//const express = require('express');
//const { google } = require('googleapis');
//const path = require('path');

//const app = express();
const PORT = process.env.PORT || 4000;

// ตั้งค่า EJS เป็น View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // กำหนดโฟลเดอร์ views

// ตั้งค่า Service Account Key
//const KEYFILEPATH = path.join(__dirname, 'credentials.json');
//const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']; // สิทธิ์การอ่านอย่างเดียว

// Spreadsheet ID ของ Google Sheet ของคุณ
//const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // *** เปลี่ยนเป็น Spreadsheet ID ของคุณ ***

async function getSheetData() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // กำหนดช่วง (range) ของข้อมูลที่ต้องการอ่าน
    // เช่น 'Sheet1!A1:D' จะอ่านข้อมูลตั้งแต่เซลล์ A1 ไปจนถึงคอลัมน์ D ทั้งหมดใน Sheet1
    const range = 'Sheet1!A:G'; // *** เปลี่ยนเป็นชื่อ Sheet และช่วงคอลัมน์ที่คุณต้องการ ***

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    return response.data.values; // คืนค่าเป็น array ของ array (ข้อมูลแต่ละแถว)

  } catch (error) {
    console.error('Error fetching data from Google Sheet:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// Spreadsheet ID ของ Google Sheet ของคุณ
//const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // *** เปลี่ยนเป็น Spreadsheet ID ของคุณ ***
const SHEET_NAME = 'Sheet1'; // *** เปลี่ยนเป็นชื่อ Sheet ของคุณ (ถ้าไม่ใช่ Sheet1) ***

// ฟังก์ชันสำหรับยืนยันตัวตนกับ Google API
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
  });
  return auth;
}

// ฟังก์ชันสำหรับอ่านข้อมูลจาก Google Sheet
async function getSheetData() {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `${SHEET_NAME}!A:G`; // อ่านข้อมูลทั้งหมดในคอลัมน์ A ถึง G

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error fetching data from Google Sheet:', error.message);
    throw error;
  }
}

// ฟังก์ชันสำหรับอ่านข้อมูลจาก Google Sheet เฉพาะบางคอลัมน์
async function getSpecificColumnsData() {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // *** สำคัญ: กำหนดช่วง (range) ของคอลัมน์ที่ต้องการโดยตรง ***
    // ตัวอย่าง: 'Sheet1!A:B' จะดึงคอลัมน์ A และ B ทั้งหมด
    // หากต้องการคอลัมน์ที่ไม่ได้อยู่ติดกัน เช่น A, B และ G คุณจะต้องเรียก API แยกกันสำหรับแต่ละช่วง
    // หรือดึงช่วงครอบคลุม A:G แล้วกรองใน Node.js เหมือนตัวอย่างก่อนหน้า
    // แต่ถ้าคอลัมน์อยู่ติดกัน เช่น A, B, C ก็ระบุ A:C ได้เลย
    const range = `${SHEET_NAME}!A:D`; // ดึงเฉพาะ Order ID (A) และ Customer Name (D)
    const range2 = `${SHEET_NAME}!G:G`; // ดึงเฉพาะ Status (G)

    // ดึงข้อมูลคอลัมน์ A:B
    const response1 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    const data1 = response1.data.values || [];

    // ดึงข้อมูลคอลัมน์ G:G
    const response2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range2,
    });
    const data2 = response2.data.values || [];

    // รวมข้อมูลจากช่วงต่างๆ
    // เราจะรวม header และ data row โดยการรวมแต่ละแถวเข้าด้วยกัน
    const combinedData = [];
    if (data1.length > 0) {
      // เพิ่ม Header
      combinedData.push([data1[0][0], data1[0][1], data1[0][2], data1[0][3], data2[0] ? data2[0][0] : 'Status']); // Assuming Status header is in G1
    }

    // รวมข้อมูลแต่ละแถว (เริ่มจากแถวที่ 2 หรือ index 1)
    for (let i = 1; i < data1.length; i++) {
        const row = [
            data1[i][0], // Order ID
            data1[i][1], // Customer Name
            data1[i][2], // Customer Name
            data1[i][3], // Customer Name
            data2[i] ? data2[i][0] : '' // Status (ตรวจสอบว่ามีข้อมูลในคอลัมน์ G หรือไม่)
        ];
        combinedData.push(row);
    }
    
    return combinedData;

  } catch (error) {
    console.error('Error fetching specific columns from Google Sheet:', error.message);
    throw error;
  }
}

// ฟังก์ชันสำหรับอัปเดตข้อมูลใน Google Sheet
// rowToUpdateIndex คือ index ของแถวใน Google Sheet ที่ต้องการอัปเดต (0-based)
// values คือ array ของข้อมูลที่จะอัปเดตในแถวนั้น เช่น ['ORD001', 'ใหม่', 'สินค้าใหม่', ...]
async function updateSheetData(rowToUpdateIndex, values) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // กำหนดช่วงเซลล์ที่จะอัปเดต
    // เช่น 'Sheet1!A2:G2' สำหรับอัปเดตแถวที่ 2 (index 1)
    const range = `${SHEET_NAME}!A${rowToUpdateIndex + 1}:G${rowToUpdateIndex + 1}`;

    const resource = {
      values: [values], // ต้องเป็น array ของ array
    };

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED', // หรือ RAW
      resource: resource,
    });

    console.log('Sheet updated successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating Google Sheet:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// กำหนด Index ของคอลัมน์ Status (0-based)
// ในตัวอย่างคือคอลัมน์ G ซึ่งเป็น Index ที่ 6
const STATUS_COLUMN_INDEX = 4; 

// Route สำหรับหน้าแรก
app.post('/main', async (req, res) => {
  try {
    const allData = await getSpecificColumnsData();
    if (!allData || allData.length === 0) {
      return res.status(404).send('No data found in Google Sheet.');
    }

    const headers = allData[0]; // แถวแรกคือ Header
    const dataRows = allData.slice(1); // ข้อมูลจริงเริ่มตั้งแต่แถวที่สอง

    // ดึงค่า status ที่ส่งมาใน query string (เช่น /?status=Pending)
    let filterStatus = req.query.status; 
    let filteredData = [];

    if (req.query.status) {
      filterStatus = req.query.status;    
    } else {
      filterStatus = 'Pending'; 
    }

    if (filterStatus==='all') {
      // ถ้าไม่มี status ใน query string ให้แสดงข้อมูลทั้งหมด
      filteredData = dataRows;
      console.log('No status filter applied, showing all data.');      
    } else {
     // กรองข้อมูลตาม status ที่ระบุ
      filteredData = dataRows.filter(row => 
        row[STATUS_COLUMN_INDEX] && row[STATUS_COLUMN_INDEX].toLowerCase() === filterStatus.toLowerCase()
      );
      console.log(`Filtered for status: ${filterStatus}, found ${filteredData.length} rows.`);
    }

    res.render('index2', {
      headers: headers,
      sheetData: filteredData,
      currentFilter: filterStatus || 'All' // ส่ง status ที่กำลังกรองไปให้ view
    });

  } catch (error) {
    res.status(500).send('Error loading data: ' + error.message);
  }
});

// Route สำหรับหน้าแรก
app.get('/main', async (req, res) => {
  try {
    const allData = await getSpecificColumnsData();
    if (!allData || allData.length === 0) {
      return res.status(404).send('No data found in Google Sheet.');
    }

    const headers = allData[0]; // แถวแรกคือ Header
    const dataRows = allData.slice(1); // ข้อมูลจริงเริ่มตั้งแต่แถวที่สอง

    // ดึงค่า status ที่ส่งมาใน query string (เช่น /?status=Pending)
    let filterStatus = req.query.status; 
    let filteredData = [];

    if (req.query.status) {
      filterStatus = req.query.status;    
    } else {
      filterStatus = 'Pending'; 
    }

    if (filterStatus==='all') {
      // ถ้าไม่มี status ใน query string ให้แสดงข้อมูลทั้งหมด
      filteredData = dataRows;
      console.log('No status filter applied, showing all data.');      
    } else {
     // กรองข้อมูลตาม status ที่ระบุ
      filteredData = dataRows.filter(row => 
        row[STATUS_COLUMN_INDEX] && row[STATUS_COLUMN_INDEX].toLowerCase() === filterStatus.toLowerCase()
      );
      console.log(`Filtered for status: ${filterStatus}, found ${filteredData.length} rows.`);
    }

    res.render('index2', {
      headers: headers,
      sheetData: filteredData,
      currentFilter: filterStatus || 'All' // ส่ง status ที่กำลังกรองไปให้ view
    });

  } catch (error) {
    res.status(500).send('Error loading data: ' + error.message);
  }
});

// Route สำหรับหน้าแสดงข้อมูลและฟอร์มแก้ไข
app.get('/update', async (req, res) => {
  try {
    const allData = await getSheetData();
    if (!allData || allData.length < 2) { // ตรวจสอบว่ามีข้อมูลและมีอย่างน้อย 1 แถวข้อมูล (ไม่รวม header)
      return res.status(404).send('No data found in Google Sheet or sheet is empty.');
    }

    const headers = allData[0]; // แถวแรกคือ header
    const params = allData[req.query.rowIndex]; // แถวแรกคือ header
    const dataRows = allData.slice(1); // ข้อมูลจริงเริ่มตั้งแต่แถวที่สอง

    //console.log('ok' + params[0]);
    // ในตัวอย่างนี้ เราจะแก้ไขข้อมูลของ Order ID 'ORD001'
    // ซึ่งสมมติว่าเป็นแถวที่ 2 ใน Google Sheet (index 1 ใน dataRows)
    const orderIdToEdit = params[0];//'ORD002';
    let rowIndexInSheet = -1; //Index ของแถวใน Google Sheet (0-based)
    let orderToEdit = null;

    // ค้นหาแถวที่มี Order ID ตรงกัน
    for (let i = 0; i < dataRows.length; i++) {
        if (dataRows[i][0] === orderIdToEdit) { // สมมติว่า Order ID อยู่ในคอลัมน์แรก (index 0)
            orderToEdit = dataRows[i];
            rowIndexInSheet = i + 1; // +1 เพราะ header อยู่ที่ index 0, data เริ่มที่ index 1
            break;
        }
    }

    if (!orderToEdit) {
        return res.status(404).send(`Order with ID ${orderIdToEdit} not found.`);
    }

    res.render('edit', {
      headers: headers,
      orderToEdit: orderToEdit,
      rowIndex: rowIndexInSheet // ส่ง index ของแถวใน Google Sheet ไปด้วย
    });

  } catch (error) {
    res.status(500).send('Error loading data: ' + error.message);
  }
});

// Route สำหรับรับข้อมูลจากฟอร์มเพื่ออัปเดต
app.post('/update', async (req, res) => {
  try {
    const { rowIndex, orderId, customerName, productName, quantity, price, orderDate, status } = req.body;

    // ตรวจสอบว่า rowIndex เป็นตัวเลขและมากกว่า 0 (ไม่สามารถอัปเดต header ได้)
    const targetRowIndex = parseInt(rowIndex, 10);
    if (isNaN(targetRowIndex) || targetRowIndex < 1) {
        return res.status(400).send('Invalid row index provided.');
    }

    // สร้าง array ของค่าที่จะอัปเดต (ต้องเรียงตามคอลัมน์ใน Google Sheet)
    const updatedValues = [
      orderId,
      customerName,
      productName,
      quantity,
      price,
      orderDate,
      status
    ];

    // เรียกฟังก์ชันอัปเดตข้อมูล
    await updateSheetData(targetRowIndex, updatedValues);

    res.redirect('/main'); // Redirect กลับไปหน้าเดิมหลังจากอัปเดตสำเร็จ
  } catch (error) {
    res.status(500).send('Error updating data: ' + error.message);
  }
});

app.get('/updatec', async (req, res) => {
  try {
    const allData = await getSheetData();
    if (!allData || allData.length < 2) { // ตรวจสอบว่ามีข้อมูลและมีอย่างน้อย 1 แถวข้อมูล (ไม่รวม header)
      return res.status(404).send('No data found in Google Sheet or sheet is empty.');
    }
    let filteredData = [];

    //if (req.query.rowIndex) {
    //  filteredData = dataRows.filter(row => row[0] && row[0].toLowerCase() === req.query.rowIndex);
    //}
    console.log('req.query.rowIndex' + req.query.rowIndex);  

    const params = allData[req.query.rowIndex]; // ดึงข้อมูลจาก index

    console.log('params' + params);  
    const { rowIndex, orderId, customerName, productName, quantity, price, orderDate, status } = params;

    // ตรวจสอบว่า rowIndex เป็นตัวเลขและมากกว่า 0 (ไม่สามารถอัปเดต header ได้)
    const targetRowIndex = parseInt(req.query.rowIndex, 10);
    if (isNaN(targetRowIndex) || targetRowIndex < 1) {
        return res.status(400).send('Invalid row index provided.');
    }

    // สร้าง array ของค่าที่จะอัปเดต (ต้องเรียงตามคอลัมน์ใน Google Sheet)
    const updatedValues = [
      orderId,
      customerName,
      productName,
      quantity,
      price,
      orderDate,
      'Completed'
    ];

    // เรียกฟังก์ชันอัปเดตข้อมูล
    await updateSheetData(targetRowIndex, updatedValues);

    res.redirect('/main'); // Redirect กลับไปหน้าเดิมหลังจากอัปเดตสำเร็จ
  } catch (error) {
    res.status(500).send('Error updating data: ' + error.message);
  }
});

// --- เริ่มต้น Server ---
app.listen(port, () => {
    console.log(`Food Order Web App is running on http://localhost:${port}`);
    console.log('Key Order http://localhost:4000');
    console.log('Open Order http://localhost:4000/main');    
});