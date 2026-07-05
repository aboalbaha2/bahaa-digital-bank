const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'bank_db.json');

// تفعيل قراءة البيانات القادمة من الواجهة بتنسيق JSON
app.use(express.json());

// دالة قراءة قاعدة البيانات بأمان
function loadAccounts() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
        return {};
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

// دالة حفظ وتحديث قاعدة البيانات
function saveAccounts(accounts) {
    fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 4), 'utf-8');
}

// 1. المسار الرئيسي لعرض واجهة المستخدم (HTML)
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'templates', 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif;">منظومة بنك البهاء الرقمية قيد الإعداد...</h1>');
});

// 2. بوابة فتح حساب جديد برصيد صفري تلقائي وآمن
app.post('/register', (req, res) => {
    const { username, pin } = req.body;
    if (!username || !pin) {
        return res.json({ status: "error", message: "يرجى ملء الحقول المصرفية بدقة" });
    }

    const accounts = loadAccounts();
    const userClean = username.toLowerCase().trim();

    if (accounts[userClean]) {
        return res.json({ status: "error", message: "اسم المستخدم مسجل مسبقاً لدينا" });
    }

    // لزيادة الأمان: نتحقق أن الـ PIN غير مكرر كمفتاح إضافي للبحث
    for (const key in accounts) {
        if (accounts[key][4] === pin) {
            return res.json({ status: "error", message: "الرمز السري (PIN) مستخدم لحساب آخر" });
        }
    }

    // هيكل المصفوفة البنكية: [اسم_العرض, الرصيد_الحالي, الديون, سجل_العمليات, الرمز_السري]
    accounts[userClean] = [username, 0.0, 0.0, ["تم إنشاء الحساب بنجاح برصيد 0.00 د.أ"], pin];
    
    saveAccounts(accounts);
    return res.json({ status: "success" });
});

// 3. بوابة تسجيل الدخول الآمن للوحة التحكم
app.post('/login', (req, res) => {
    const { username, pin } = req.body;
    if (!username || !pin) {
        return res.json({ status: "error", message: "يرجى إدخال اسم المستخدم والرمز السري" });
    }

    const accounts = loadAccounts();
    const userClean = username.toLowerCase().trim();

    if (accounts[userClean] && accounts[userClean][4] === pin) {
        return res.json({
            status: "success",
            username: accounts[userClean][0],
            updated_balance: accounts[userClean][1]
        });
    }
    return res.json({ status: "error", message: "بيانات الدخول غير صحيحة" });
});

// 4. بوابة تحويل الأموال الفورية بين المحافظ الرقمية
app.post('/transfer', (req, res) => {
    const { sender_pin, receiver_pin, amount } = req.body; // هنا receiver_pin يحمل اسم المستلم من الواجهة
    const transferAmount = parseFloat(amount);

    if (!sender_pin || !receiver_pin || isNaN(transferAmount) || transferAmount <= 0) {
        return res.json({ status: "error", message: "بيانات التحويل غير صالحة" });
    }

    const accounts = loadAccounts();
    let senderKey = null;
    const receiverKey = receiver_pin.toLowerCase().trim();

    // البحث عن المرسل بواسطة الـ PIN الخاص به وثوقيةً للجلسة
    for (const key in accounts) {
        if (accounts[key][4] === sender_pin) {
            senderKey = key;
            break;
        }
    }

    if (!senderKey) {
        return res.json({ status: "error", message: "جلسة العمل غير صالحة أو الرمز السري خاطئ" });
    }
    if (!accounts[receiverKey]) {
        return res.json({ status: "error", message: "حساب المستلم غير موجود في منظومتنا" });
    }
    if (senderKey === receiverKey) {
        return res.json({ status: "error", message: "لا يمكنك التحويل لنفس حسابك" });
    }
    if (accounts[senderKey][1] < transferAmount) {
        return res.json({ status: "error", message: "رصيدك الحالي غير كافٍ لإتمام الحوالة" });
    }

    // تنفيذ الحوالة البنكية اللحظية
    accounts[senderKey][1] -= transferAmount;
    accounts[receiverKey][1] += transferAmount;

    // توثيق العملية في كشف الحساب للطرفين
    accounts[senderKey][3].push(`تحويل مبلغ ${transferAmount} د.أ إلى ${accounts[receiverKey][0]}`);
    accounts[receiverKey][3].push(`استلام حوالة بمبلغ ${transferAmount} د.أ من ${accounts[senderKey][0]}`);

    saveAccounts(accounts);
    return res.json({ status: "success", updated_balance: accounts[senderKey][1] });
});

// 5. بوابة طلب القروض والتمويل المالي الآمن
app.post('/loan', (req, res) => {
    const { pin, amount } = req.body;
    const loanAmount = parseFloat(amount);

    if (!pin || isNaN(loanAmount) || loanAmount <= 0) {
        return res.json({ status: "error", message: "مبلغ التمويل غير صحيح" });
    }

    const accounts = loadAccounts();
    let userKey = null;

    for (const key in accounts) {
        if (accounts[key][4] === pin) {
            userKey = key;
            break;
        }
    }

    if (!userKey) {
        return res.json({ status: "error", message: "الرمز السري غير صحيح لاعتماد التمويل" });
    }

    // إضافة مبلغ القرض للرصيد وتسجيله كدين مطلوب سداده
    accounts[userKey][1] += loanAmount; // زيادة الرصيد الحالي
    accounts[userKey][2] += loanAmount; // زيادة الديون
    accounts[userKey][3].push(`موافقة ائتمانية على قرض بمبلغ ${loanAmount} د.أ`);

    saveAccounts(accounts);
    return res.json({ status: "success", updated_balance: accounts[userKey][1] });
});

// 6. بوابة استخراج كشف الحساب اللحظي الموثق
app.post('/statement', (req, res) => {
    const { pin } = req.body;
    const accounts = loadAccounts();
    
    for (const key in accounts) {
        if (accounts[key][4] === pin) {
            return res.json({ status: "success", statement: accounts[key][3] });
        }
    }
    return res.json({ status: "error", message: "فشل التحقق من الهوية لطلب كشف الحساب" });
});

// إقلاع خادم بنك البهاء الرقمي الشامل
app.listen(PORT, () => {
    console.log(`Bahaa Digital Bank Server is live and running perfectly on port ${PORT}`);
});
