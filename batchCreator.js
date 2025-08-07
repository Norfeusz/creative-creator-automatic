const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const xlsx = require('xlsx');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

const API_BASE_URL = 'https://api.system.netsalesmedia.pl';
const LINK_TXT_FOLDER_NAME = 'Link TXT';

const API_URL_LIST_SETS = `${API_BASE_URL}/creatives/creativeset/list`;
const API_URL_GET_SINGLE_SET = `${API_BASE_URL}/creatives/creativeset/single`;
const API_URL_CREATE_SET = `${API_BASE_URL}/creatives/creativeset/create`;
const API_URL_CREATE_CREATIVE = `${API_BASE_URL}/creatives/creative/link/create`;
const API_URL_GET_TRACKING_CATEGORIES = `${API_BASE_URL}/partnerships/advertiser/findTrackingCategories`;
const API_URL_GET_USER_INFO = `${API_BASE_URL}/access/user/get`;

// --- Funkcje pomocnicze ---
async function findLinkTxtFolderId(advertiserId, apiKey) {
    try {
        const searchPattern = /link/i;
        const config = { headers: { 'x-api-key': apiKey }, params: { advertiserId: advertiserId } };
        const response = await axios.get(API_URL_LIST_SETS, config);
        if (response.status !== 200) { return null; }
        if (response.data && Array.isArray(response.data)) {
            const linkTxtFolder = response.data.find(set => searchPattern.test(set.name));
            return linkTxtFolder ? linkTxtFolder.creativeSetId : null;
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function getProductCategoryIdFromSet(creativeSetId, apiKey) {
    try {
        const config = { headers: { 'x-api-key': apiKey }, params: { creativeSetId: creativeSetId } };
        const response = await axios.get(API_URL_GET_SINGLE_SET, config);
        if (response.status !== 200) { return null; }
        if (response.data && response.data.productCategoryId) { return response.data.productCategoryId; }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function getAdvertiserDefaultCategory(advertiserId, apiKey) {
    try {
        const iqlQuery = `advertiser.id = '${advertiserId}'`;
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'text/plain' } };
        const response = await axios.post(API_URL_GET_TRACKING_CATEGORIES, iqlQuery, config);
        if (response.data && Array.isArray(response.data.entries) && response.data.entries.length > 0) {
            return response.data.entries[0].trackingCategoryId;
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function createNewSubfolder(advertiserId, parentCreativeSetId, folderName, defaultTargetUrl, productCategoryId, apiKey) {
    try {
        const requestBody = { commandId: uuidv4(), creativeSetId: uuidv4(), advertiserId: advertiserId, parentCreativeSetId: parentCreativeSetId, name: folderName, defaultTargetURL: defaultTargetUrl, productCategoryId: productCategoryId };
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } };
        const response = await axios.post(API_URL_CREATE_SET, requestBody, config);
        if (response.status !== 200) { return null; }
        if (response.data && response.data.errors) { return null; }
        return requestBody.creativeSetId;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function createNewCreativeSet(advertiserId, folderName, defaultTargetUrl, productCategoryId, apiKey) {
    try {
        const requestBody = { commandId: uuidv4(), creativeSetId: uuidv4(), advertiserId: advertiserId, name: folderName, defaultTargetURL: defaultTargetUrl, productCategoryId: productCategoryId };
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } };
        const response = await axios.post(API_URL_CREATE_SET, requestBody, config);
        if (response.status !== 200) { return null; }
        if (response.data && response.data.errors) { return null; }
        return requestBody.creativeSetId;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function createLinkCreative(creativeData, apiKey) {
    try {
        const requestBody = { commandId: uuidv4(), creativeId: uuidv4(), creativeSetId: creativeData.creativeSetId, name: creativeData.creativeName, content: '.', description: 'Automatycznie stworzona kreacja przez skrypt', targetUrl: creativeData.targetUrl, status: 'ACTIVE' };
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } };
        const response = await axios.post(API_URL_CREATE_CREATIVE, requestBody, config);
        if (response.status !== 200) { return null; }
        if (response.data && response.data.errors) { return null; }
        return { ...response.data, creativeName: creativeData.creativeName };
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return null;
    }
}

async function findHighestCreativeNumber(parentCreativeSetId, advertiserId, apiKey) {
    try {
        const config = { headers: { 'x-api-key': apiKey }, params: { creativeSetId: parentCreativeSetId, advertiserId: advertiserId } };
        const response = await axios.get(API_URL_LIST_SETS, config);
        if (response.data && Array.isArray(response.data)) {
            let highestNumber = 0;
            response.data.forEach(set => {
                const match = set.name.match(/^(\d+)/);
                if (match) {
                    const number = parseInt(match[1], 10);
                    if (number > highestNumber) { highestNumber = number; }
                }
            });
            return highestNumber;
        }
        return 0;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) { throw new Error("unauthorized"); }
        if (error.response) console.error('Szczegóły błędu:', error.response.data);
        return 0;
    }
}

// --- Główna funkcja zarządzająca całym procesem ---
async function runAutomation(record, apiKey) {
    const { advertiserId, creativeName, campaignPeriod, targetUrl } = record;

    let urlSeparator = '?';
    if (targetUrl.includes('?')) { urlSeparator = '&'; }

    let finalTargetUrl = targetUrl;
    if (advertiserId === '76829') {
        const urlParams = `${urlSeparator}utm_source=pp&utm_medium=cps&utm_campaign=SalesMedia&utm_content=#{PARTNER_ID}`;
        finalTargetUrl = `${targetUrl}${urlParams}`;
    }

    try {
        let parentFolderId = await findLinkTxtFolderId(advertiserId, apiKey);
        let productCategoryId;

        if (!parentFolderId) {
            productCategoryId = await getAdvertiserDefaultCategory(advertiserId, apiKey);
            if (!productCategoryId) { return { success: false, message: 'Nie udało się pobrać ID domyślnej kategorii produktu dla tego reklamodawcy.' }; }
            parentFolderId = await createNewCreativeSet(advertiserId, LINK_TXT_FOLDER_NAME, finalTargetUrl, productCategoryId, apiKey);
            if (!parentFolderId) { return { success: false, message: 'Nie udało się utworzyć głównego folderu Link TXT.' }; }
        } else {
            productCategoryId = await getProductCategoryIdFromSet(parentFolderId, apiKey);
            if (!productCategoryId) { return { success: false, message: 'Nie udało się pobrać ID kategorii produktu z folderu Link TXT.' }; }
        }

        const highestNumber = await findHighestCreativeNumber(parentFolderId, advertiserId, apiKey);
        const newCreativeNumber = highestNumber + 1;

        let newCreativeFolderName;
        if (campaignPeriod) { newCreativeFolderName = `${newCreativeNumber} - ${creativeName} - ${campaignPeriod}`; } else { newCreativeFolderName = `${newCreativeNumber} - ${creativeName}`; }

        const newFolderId = await createNewSubfolder(advertiserId, parentFolderId, newCreativeFolderName, finalTargetUrl, productCategoryId, apiKey);
        if (!newFolderId) { return { success: false, message: `Nie udało się utworzyć nowego folderu dla kreacji "${creativeName}". Sprawdź, czy URL jest poprawny.` }; }

        const creativeNameWithPrefix = `LinkTXT - ${newCreativeFolderName}`;
        const myCreative = { creativeName: creativeNameWithPrefix, content: '.', creativeSetId: newFolderId, targetUrl: finalTargetUrl };
        const creationResult = await createLinkCreative(myCreative, apiKey);

        if (creationResult) {
            return { success: true, message: `Kreacja "${creativeNameWithPrefix}" została pomyślnie utworzona!` };
        } else {
            return { success: false, message: `Nie udało się utworzyć kreacji "${creativeNameWithPrefix}". Upewnij się, że link docelowy jest poprawny.` };
        }
    } catch (error) {
        if (error.message === "unauthorized") {
            return { success: false, message: `Błąd dla kreacji "${creativeName}": Podałeś nieprawidłowy API Key, lub nie masz uprawnień do dodawania kreacji.` };
        }
        return { success: false, message: `Wystąpił nieoczekiwany błąd podczas automatyzacji dla kreacji "${creativeName}": ${error.message}` };
    }
}

// --- Endpointy API ---
app.post('/verify-api-key', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) { return res.status(400).json({ success: false, message: 'Błąd: Brakuje klucza API.' }); }

    try {
        const config = { headers: { 'x-api-key': apiKey } };
        await axios.get(API_URL_GET_USER_INFO, config);
        res.status(200).json({ success: true, message: 'Klucz API zweryfikowany pomyślnie!' });
    } catch (error) {
        console.error('Błąd podczas weryfikacji klucza:', error);
        res.status(401).json({ success: false, message: 'Nieprawidłowy klucz API lub brak uprawnień.' });
    }
});

app.post('/upload', upload.single('xlsxFile'), async (req, res) => {
    const { apiKey } = req.body;
    const file = req.file;

    if (!apiKey || !file) { return res.status(400).json({ success: false, message: 'Błąd: Brakuje klucza API lub pliku.' }); }
    
    try {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = xlsx.utils.sheet_to_json(worksheet);

        if (records.length === 0) { return res.status(400).json({ success: false, message: 'Błąd: Plik Excel jest pusty lub nie zawiera poprawnych nagłówków.' }); }
        
        const results = [];
        for (const record of records) {
            const requiredFields = ['advertiserId', 'creativeName', 'targetUrl'];
            const missingFields = requiredFields.filter(field => !record[field]);
            
            if (missingFields.length > 0) {
                const creativeName = record.creativeName || 'Brak nazwy';
                results.push({
                    success: false,
                    message: `Kreacja "${creativeName}" nie została utworzona. Brakuje wymaganych kolumn: ${missingFields.join(', ')}.`
                });
                continue;
            }
            const advertiserId = String(record.advertiserId);
            const creativeName = String(record.creativeName);
            const campaignPeriod = record.campaignPeriod ? String(record.campaignPeriod) : null;
            const targetUrl = String(record.targetUrl);

            const result = await runAutomation({ advertiserId, creativeName, campaignPeriod, targetUrl }, apiKey);
            results.push(result);
        }
        res.status(200).json({ success: true, message: 'Przetwarzanie zakończone. Poniżej lista statusów utworzonych kreacji.', results });
    } catch (error) {
        console.error('Błąd podczas przetwarzania pliku:', error);
        res.status(500).json({ success: false, message: 'Wystąpił błąd podczas przetwarzania pliku.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Kreator-link-automatyczny nasłuchuje na porcie ${port}`);
    console.log(`Otwórz http://localhost:${port}/ w swojej przeglądarce.`);
});