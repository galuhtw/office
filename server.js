

// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi OpenAI API
const configuration = new Configuration({
    apiKey: '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', // Ganti dengan API key Anda
});
const openai = new OpenAIApi(configuration);

// Konfigurasi multer untuk penyimpanan file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Folder untuk menyimpan file yang diunggah
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    },
});
const upload = multer({ storage: storage });

// Endpoint untuk unggah dan proses file
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'File tidak ditemukan.' });
        }

        let textContent = '';

        // Membaca dan mengekstrak teks dari file
        if (file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            textContent = pdfData.text;
        } else if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/msword'
        ) {
            const result = await mammoth.extractRawText({ path: file.path });
            textContent = result.value;
        } else if (file.mimetype === 'text/plain') {
            textContent = fs.readFileSync(file.path, 'utf8');
        } else {
            return res.status(400).json({ message: 'Format file tidak didukung.' });
        }

        // Menghapus file setelah dibaca
        fs.unlinkSync(file.path);

        // System prompt untuk OpenAI API
        const systemPrompt = `Anda adalah seorang ahli dalam membaca surat terlampir dalam chat ini, lalu memberikan summary terkait hal-hal penting yang ada dalam surat. Tugas anda adalah :
1. Memberikan executive summary atas dokumen surat yang ditujukan untuk pejabat di pemerintah kota surabaya dalam 100 kata
2. Memberikan Label tingkat kepentingan surat terhadap warga kota surabaya ataupun pemerintah kota surabaya dengan label "Biasa" atau "Penting" atau "Sangat Penting"
3. Memberikan label urgensitas surat dengan label "Sangat Segera" atau "Segera" atau "Biasa"
4. Berilah disposisi perintah kepada bawahan atas surat tersebut sesuai dengan poin nomor 2 dan 3 jika tidak urgen dan tidak penting maka disposisi cukup “untuk diketahui”`;

        // Memanggil OpenAI API dengan textContent dan system prompt
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: textContent },
            ],
        });

        // Mengambil respons dari OpenAI
        const responseText = completion.data.choices[0].message.content;

        // Memproses respons untuk mendapatkan output yang diinginkan
        const output = processOpenAIResponse(responseText);

        // Menyimpan riwayat (dalam implementasi nyata, simpan ke database)
        // Untuk contoh ini, kita kirim kembali output ke frontend
        res.json({
            filename: file.originalname,
            summary: output.summary,
            tingkat_kepentingan: output.tingkatKepentingan,
            urgensitas: output.urgensitas,
            disposisi: output.disposisi,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// Fungsi untuk memproses respons dari OpenAI menjadi bagian-bagian yang diperlukan
function processOpenAIResponse(responseText) {
    // Misal, kita menggunakan pemisah garis baru untuk membagi bagian
    const lines = responseText.split('\n').filter(line => line.trim() !== '');
    let summary = '';
    let tingkatKepentingan = '';
    let urgensitas = '';
    let disposisi = '';

    lines.forEach(line => {
        if (line.toLowerCase().includes('summary') || line.toLowerCase().includes('executive summary')) {
            summary += line + ' ';
        } else if (line.toLowerCase().includes('tingkat kepentingan')) {
            tingkatKepentingan = line.split(':')[1]?.trim() || line.trim();
        } else if (line.toLowerCase().includes('urgensitas')) {
            urgensitas = line.split(':')[1]?.trim() || line.trim();
        } else if (line.toLowerCase().includes('disposisi')) {
            disposisi = line.split(':')[1]?.trim() || line.trim();
        }
    });

    return {
        summary: summary.trim(),
        tingkatKepentingan,
        urgensitas,
        disposisi,
    };
}

// Menjalankan server pada port 3000
app.listen(3000, () => {
    console.log('Server berjalan pada http://localhost:3000');
});
```
