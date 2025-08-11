// Uruchomienie skryptu po całkowitym załadowaniu struktury DOM strony
document.addEventListener('DOMContentLoaded', () => {
    // Pobranie referencji do wszystkich potrzebnych elementów DOM 
    const apiKeyVerification = document.getElementById('apiKeyVerification');
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKeyMessageContainer = document.getElementById('apiKeyMessageContainer');
    
    const mainContent = document.getElementById('mainContent');
    const uploadForm = document.getElementById('uploadForm');
    const uploadMessageContainer = document.getElementById('uploadMessageContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const creationsList = document.getElementById('creationsList');

    // Dodanie nasłuchiwania na zdarzenie 'submit' dla formularza weryfikacji klucza API
    apiKeyForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Zapobiegamy domyślnemu przeładowaniu strony po wysłaniu formularza
        apiKeyMessageContainer.textContent = 'Weryfikacja klucza...';
        apiKeyMessageContainer.className = 'message'; // Reset klas CSS

        const apiKey = apiKeyInput.value.trim(); // Pobranie klucza i usunięcie białych znaków
        if (!apiKey) {
            apiKeyMessageContainer.textContent = 'Proszę wprowadzić klucz API.';
            apiKeyMessageContainer.classList.add('error');
            return;
        }

        try {
            // Wysłanie zapytania POST do serwera w celu weryfikacji klucza
            const response = await fetch('/verify-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            });

            const result = await response.json();
            
            if (response.ok) {
                // Jeśli klucz jest poprawny, pokazujemy główną część aplikacji
                apiKeyMessageContainer.textContent = result.message;
                apiKeyMessageContainer.classList.add('success');
                
                apiKeyVerification.style.display = 'none'; // Ukryj formularz API
                mainContent.style.display = 'block'; // Pokaż formularz do wgrywania plików

                // Zapisanie klucza w sessionStorage, aby był dostępny na czas trwania sesji
                sessionStorage.setItem('apiKey', apiKey);
            } else {
                // Jeśli klucz jest niepoprawny, wyświetlamy błąd
                apiKeyMessageContainer.textContent = result.message;
                apiKeyMessageContainer.classList.add('error');
            }
        } catch (error) {
            // Obsługa błędów sieciowych lub braku odpowiedzi od serwera
            apiKeyMessageContainer.textContent = 'Wystąpił nieoczekiwany błąd serwera podczas weryfikacji.';
            apiKeyMessageContainer.classList.add('error');
        }
    });

    // Dodanie nasłuchiwania na zdarzenie 'submit' dla formularza wgrywania pliku XLSX
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Zapobiegamy przeładowaniu strony
        uploadMessageContainer.textContent = 'Przetwarzanie pliku... Proszę czekać.';
        uploadMessageContainer.className = 'message';

        // Utworzenie obiektu FormData, który pozwoli na wysłanie pliku
        const formData = new FormData(uploadForm);
        const apiKey = sessionStorage.getItem('apiKey'); // Pobranie klucza API z pamięci sesji
        formData.append('apiKey', apiKey); // Dołączenie klucza do wysyłanych danych

        try {
            // Wysłanie zapytania POST z plikiem i kluczem API do serwera
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData // W ciele zapytania wysyłamy obiekt FormData
            });

            const result = await response.json();
            
            if (response.ok) {
                // Po pomyślnym przetworzeniu pliku na serwerze
                uploadMessageContainer.textContent = result.message;
                uploadMessageContainer.classList.add('success');
                uploadForm.reset(); // Wyczyszczenie formularza
                
                // Wyświetlenie kontenera z wynikami
                resultsContainer.style.display = 'block';
                creationsList.innerHTML = ''; // Wyczyszczenie poprzednich wyników
                
                // Iteracja po wynikach zwróconych przez serwer i tworzenie listy statusów
                result.results.forEach(creationResult => {
                    const listItem = document.createElement('li');
                    if (creationResult.success) {
                        listItem.textContent = `✅ ${creationResult.message}`;
                        listItem.classList.add('success-item');
                    } else {
                        listItem.textContent = `❌ ${creationResult.message}`;
                        listItem.classList.add('error-item');
                    }
                    creationsList.appendChild(listItem);
                });

            } else {
                // Obsługa błędu zwróconego przez serwer (np. zły format pliku)
                uploadMessageContainer.textContent = result.message;
                uploadMessageContainer.classList.add('error');
            }
        } catch (error) {
            // Obsługa błędów sieciowych
            uploadMessageContainer.textContent = 'Wystąpił nieoczekiwany błąd serwera.';
            uploadMessageContainer.classList.add('error');
        }
    });
});