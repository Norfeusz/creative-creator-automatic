const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const xlsx = require('xlsx');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware do parsowania JSON, danych z formularzy i serwowania plików statycznych z folderu 'public'
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfiguracja multer do przechowywania wgranego pliku w pamięci serwera
const upload = multer({ storage: multer.memoryStorage() });

// Stałe przechowujące kluczowe informacje, jak bazowy URL API i nazwa folderu
const API_BASE_URL = 'https://api.system.netsalesmedia.pl';
const LINK_TXT_FOLDER_NAME = 'Link TXT';

// Stałe przechowujące pełne adresy URL do poszczególnych endpointów API
const API_URL_LIST_SETS = `${API_BASE_URL}/creatives/creativeset/list`;
const API_URL_GET_SINGLE_SET = `${API_BASE_URL}/creatives/creativeset/single`;
const API_URL_CREATE_SET = `${API_BASE_URL}/creatives/creativeset/create`;
const API_URL_CREATE_CREATIVE = `${API_BASE_URL}/creatives/creative/link/create`;
const API_URL_GET_TRACKING_CATEGORIES = `${API_BASE_URL}/partnerships/advertiser/findTrackingCategories`;
const API_URL_GET_USER_INFO = `${API_BASE_URL}/access/user/get`;

/**
 * Wyszukuje ID folderu "Link TXT" dla danego reklamodawcy.
 * @param {string} advertiserId - ID reklamodawcy.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<string|null>} ID folderu lub null, jeśli nie znaleziono.
 */
async function findLinkTxtFolderId(advertiserId, apiKey) {
    try {
        const searchPattern = /link/i; // Szukamy folderu zawierającego "link" w nazwie, ignorując wielkość liter
        const config = { headers: { 'x-api-key': apiKey }, params: { advertiserId } };
        const response = await axios.get(API_URL_LIST_SETS, config);
        
        if (response.status === 200 && Array.isArray(response.data)) {
            const linkTxtFolder = response.data.find(set => searchPattern.test(set.name));
            return linkTxtFolder ? linkTxtFolder.creativeSetId : null;
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized"); // Rzucamy specyficzny błąd przy problemach z autoryzacją
        }
        console.error('Szczegóły błędu w findLinkTxtFolderId:', error.response?.data);
        return null;
    }
}

/**
 * Pobiera ID kategorii produktu z istniejącego zestawu kreacji (folderu).
 * @param {string} creativeSetId - ID folderu kreacji.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<string|null>} ID kategorii produktu lub null.
 */
async function getProductCategoryIdFromSet(creativeSetId, apiKey) {
    try {
        const config = { headers: { 'x-api-key': apiKey }, params: { creativeSetId } };
        const response = await axios.get(API_URL_GET_SINGLE_SET, config);

        if (response.status === 200 && response.data?.productCategoryId) {
            return response.data.productCategoryId;
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized");
        }
        console.error('Szczegóły błędu w getProductCategoryIdFromSet:', error.response?.data);
        return null;
    }
}

/**
 * Pobiera domyślną kategorię śledzenia (traktowaną jako kategoria produktu) dla reklamodawcy.
 * @param {string} advertiserId - ID reklamodawcy.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<string|null>} ID domyślnej kategorii lub null.
 */
async function getAdvertiserDefaultCategory(advertiserId, apiKey) {
    try {
        const iqlQuery = `advertiser.id = '${advertiserId}'`;
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'text/plain' } };
        const response = await axios.post(API_URL_GET_TRACKING_CATEGORIES, iqlQuery, config);

        if (response.data?.entries?.length > 0) {
            return response.data.entries[0].trackingCategoryId;
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized");
        }
        console.error('Szczegóły błędu w getAdvertiserDefaultCategory:', error.response?.data);
        return null;
    }
}

/**
 * Tworzy nowy zestaw kreacji (folder lub podfolder).
 * @param {object} setData - Dane potrzebne do utworzenia zestawu.
 * @param {string} setData.advertiserId - ID reklamodawcy.
 * @param {string} setData.name - Nazwa folderu.
 * @param {string} setData.defaultTargetURL - Domyślny URL docelowy.
 * @param {string} setData.productCategoryId - ID kategorii produktu.
 * @param {string|null} [setData.parentCreativeSetId] - Opcjonalne ID folderu nadrzędnego.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<string|null>} ID nowo utworzonego folderu lub null.
 */
async function createCreativeSet({ advertiserId, name, defaultTargetURL, productCategoryId, parentCreativeSetId = null }, apiKey) {
    try {
        const newCreativeSetId = uuidv4();
        const requestBody = {
            commandId: uuidv4(),
            creativeSetId: newCreativeSetId,
            advertiserId,
            name,
            defaultTargetURL,
            productCategoryId,
        };
        
        // Jeśli podano ID rodzica, dodajemy je do zapytania, tworząc podfolder
        if (parentCreativeSetId) {
            requestBody.parentCreativeSetId = parentCreativeSetId;
        }

        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } };
        const response = await axios.post(API_URL_CREATE_SET, requestBody, config);
        
        if (response.status === 200 && !response.data?.errors) {
            return newCreativeSetId; // Zwracamy ID, które sami wygenerowaliśmy
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized");
        }
        console.error('Szczegóły błędu w createCreativeSet:', error.response?.data);
        return null;
    }
}


/**
 * Tworzy nową kreację typu link w określonym folderze.
 * @param {object} creativeData - Dane kreacji.
 * @param {string} creativeData.creativeSetId - ID folderu, w którym ma powstać kreacja.
 * @param {string} creativeData.creativeName - Nazwa kreacji.
 * @param {string} creativeData.targetUrl - URL docelowy kreacji.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<object|null>} Obiekt z wynikiem operacji lub null.
 */
async function createLinkCreative(creativeData, apiKey) {
    try {
        const requestBody = {
            commandId: uuidv4(),
            creativeId: uuidv4(),
            creativeSetId: creativeData.creativeSetId,
            name: creativeData.creativeName,
            content: '.', // Dla kreacji linkowej to pole jest wymagane, ale jego treść nie ma znaczenia
            description: 'Automatycznie stworzona kreacja przez skrypt',
            targetUrl: creativeData.targetUrl,
            status: 'ACTIVE'
        };
        const config = { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } };
        const response = await axios.post(API_URL_CREATE_CREATIVE, requestBody, config);

        if (response.status === 200 && !response.data?.errors) {
            return { ...response.data, creativeName: creativeData.creativeName };
        }
        return null;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized");
        }
        console.error('Szczegóły błędu w createLinkCreative:', error.response?.data);
        return null;
    }
}

/**
 * Znajduje najwyższy numer porządkowy wśród folderów w danym folderze nadrzędnym.
 * Używane do automatycznego nadawania kolejnych numerów nowym folderom.
 * @param {string} parentCreativeSetId - ID folderu nadrzędnego.
 * @param {string} advertiserId - ID reklamodawcy.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<number>} Najwyższy znaleziony numer lub 0.
 */
async function findHighestCreativeNumber(parentCreativeSetId, advertiserId, apiKey) {
    try {
        // Parametry zapytania zawężają listę do podfolderów danego folderu
        const config = { headers: { 'x-api-key': apiKey }, params: { creativeSetId: parentCreativeSetId, advertiserId } };
        const response = await axios.get(API_URL_LIST_SETS, config);

        if (response.data && Array.isArray(response.data)) {
            let highestNumber = 0;
            response.data.forEach(set => {
                const match = set.name.match(/^(\d+)/); // Szukamy folderów, których nazwa zaczyna się od cyfr
                if (match) {
                    const number = parseInt(match[1], 10);
                    if (number > highestNumber) {
                        highestNumber = number;
                    }
                }
            });
            return highestNumber;
        }
        return 0;
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error("unauthorized");
        }
        console.error('Szczegóły błędu w findHighestCreativeNumber:', error.response?.data);
        return 0;
    }
}

/**
 * Główna funkcja orkiestrująca cały proces tworzenia kreacji dla pojedynczego rekordu.
 * @param {object} record - Pojedynczy wiersz z pliku XLSX.
 * @param {string} apiKey - Klucz API użytkownika.
 * @returns {Promise<object>} Obiekt z informacją o sukcesie lub porażce.
 */
async function runAutomation(record, apiKey) {
    const { advertiserId, creativeName, campaignPeriod, targetUrl } = record;

    // Automatyczne dodawanie parametrów UTM dla Taniej książki
    let finalTargetUrl = targetUrl;
    if (advertiserId === '76829') {
        const urlSeparator = targetUrl.includes('?') ? '&' : '?';
        const urlParams = `${urlSeparator}utm_source=pp&utm_medium=cps&utm_campaign=SalesMedia&utm_content=#{PARTNER_ID}`;
        finalTargetUrl = `${targetUrl}${urlParams}`;
    }

    try {
        // Krok 1: Znajdź główny folder "Link TXT" lub utwórz go, jeśli nie istnieje.
        let parentFolderId = await findLinkTxtFolderId(advertiserId, apiKey);
        let productCategoryId;

        if (!parentFolderId) {
            productCategoryId = await getAdvertiserDefaultCategory(advertiserId, apiKey);
            if (!productCategoryId) return { success: false, message: 'Nie udało się pobrać ID domyślnej kategorii produktu dla tego reklamodawcy.' };
            
            parentFolderId = await createCreativeSet({
                advertiserId,
                name: LINK_TXT_FOLDER_NAME,
                defaultTargetURL: finalTargetUrl,
                productCategoryId
            }, apiKey);

            if (!parentFolderId) return { success: false, message: 'Nie udało się utworzyć głównego folderu Link TXT.' };
        } else {
            productCategoryId = await getProductCategoryIdFromSet(parentFolderId, apiKey);
            if (!productCategoryId) return { success: false, message: 'Nie udało się pobrać ID kategorii produktu z folderu Link TXT.' };
        }

        // Krok 2: Znajdź najwyższy numer istniejącego podfolderu, aby stworzyć kolejny.
        const highestNumber = await findHighestCreativeNumber(parentFolderId, advertiserId, apiKey);
        const newCreativeNumber = highestNumber + 1;

        // Krok 3: Utwórz nazwę dla nowego podfolderu kreacji.
        let newCreativeFolderName = `${newCreativeNumber} - ${creativeName}`;
        if (campaignPeriod) {
            newCreativeFolderName += ` - ${campaignPeriod}`;
        }
        
        // Krok 4: Utwórz nowy podfolder dla kreacji.
        const newFolderId = await createCreativeSet({
            advertiserId,
            parentCreativeSetId: parentFolderId,
            name: newCreativeFolderName,
            defaultTargetURL: finalTargetUrl,
            productCategoryId
        }, apiKey);

        if (!newFolderId) return { success: false, message: `Nie udało się utworzyć nowego folderu dla kreacji "${creativeName}". Sprawdź, czy URL jest poprawny.` };

        // Krok 5: Utwórz finalną kreację linkową w nowym podfolderze.
        const creativeNameWithPrefix = `LinkTXT - ${newCreativeFolderName}`;
        const myCreative = { creativeName: creativeNameWithPrefix, creativeSetId: newFolderId, targetUrl: finalTargetUrl };
        const creationResult = await createLinkCreative(myCreative, apiKey);

        if (creationResult) {
            return { success: true, message: `Kreacja "${creativeNameWithPrefix}" została pomyślnie utworzona!` };
        } else {
            return { success: false, message: `Nie udało się utworzyć kreacji "${creativeNameWithPrefix}". Upewnij się, że link docelowy jest poprawny.` };
        }
    } catch (error) {
        if (error.message === "unauthorized") {
            return { success: false, message: `Błąd dla kreacji "${creativeName}": Podałeś nieprawidłowy API Key lub nie masz uprawnień.` };
        }
        return { success: false, message: `Wystąpił nieoczekiwany błąd dla kreacji "${creativeName}": ${error.message}` };
    }
}

// Endpoint do weryfikacji klucza API
app.post('/verify-api-key', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
        return res.status(400).json({ success: false, message: 'Błąd: Brakuje klucza API.' });
    }

    try {
        // Wykonujemy proste zapytanie do API, aby sprawdzić, czy klucz jest poprawny
        const config = { headers: { 'x-api-key': apiKey } };
        await axios.get(API_URL_GET_USER_INFO, config);
        res.status(200).json({ success: true, message: 'Klucz API zweryfikowany pomyślnie!' });
    } catch (error) {
        console.error('Błąd podczas weryfikacji klucza:', error.message);
        res.status(401).json({ success: false, message: 'Nieprawidłowy klucz API lub brak uprawnień.' });
    }
});

// Endpoint do wgrywania pliku XLSX i uruchamiania procesu automatyzacji
app.post('/upload', upload.single('xlsxFile'), async (req, res) => {
    const { apiKey } = req.body;
    const file = req.file;

    if (!apiKey || !file) {
        return res.status(400).json({ success: false, message: 'Błąd: Brakuje klucza API lub pliku.' });
    }
    
    try {
        // Wczytanie danych z bufora pliku XLSX
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = xlsx.utils.sheet_to_json(worksheet);

        if (records.length === 0) {
            return res.status(400).json({ success: false, message: 'Błąd: Plik Excel jest pusty lub ma nieprawidłowy format.' });
        }
        
        const results = [];
        // Iteracja przez każdy wiersz z pliku i uruchomienie dla niego automatyzacji
        for (const record of records) {
            // Walidacja, czy wiersz zawiera wszystkie wymagane kolumny
            const requiredFields = ['advertiserId', 'creativeName', 'targetUrl'];
            const missingFields = requiredFields.filter(field => !record[field]);
            
            if (missingFields.length > 0) {
                const creativeName = record.creativeName || 'Brak nazwy';
                results.push({
                    success: false,
                    message: `Kreacja "${creativeName}" pominięta. Brakuje danych w kolumnach: ${missingFields.join(', ')}.`
                });
                continue; // Przejdź do następnego rekordu
            }

            // Przekształcenie danych na stringi dla pewności
            const processedRecord = {
                advertiserId: String(record.advertiserId),
                creativeName: String(record.creativeName),
                campaignPeriod: record.campaignPeriod ? String(record.campaignPeriod) : null,
                targetUrl: String(record.targetUrl)
            };

            const result = await runAutomation(processedRecord, apiKey);
            results.push(result);
        }
        res.status(200).json({ success: true, message: 'Przetwarzanie zakończone. Sprawdź statusy poniżej.', results });
    } catch (error) {
        console.error('Błąd podczas przetwarzania pliku:', error);
        res.status(500).json({ success: false, message: 'Wystąpił krytyczny błąd serwera podczas przetwarzania pliku.' });
    }
});

// Endpoint główny, serwujący plik index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Uruchomienie serwera Express
app.listen(port, () => {
    console.log(`Kreator-link-automatyczny nasłuchuje na porcie ${port}`);
    console.log(`Otwórz http://localhost:${port}/ w swojej przeglądarce.`);
});