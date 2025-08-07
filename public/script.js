document.addEventListener('DOMContentLoaded', () => {
    const apiKeyVerification = document.getElementById('apiKeyVerification');
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKeyMessageContainer = document.getElementById('apiKeyMessageContainer');
    
    const mainContent = document.getElementById('mainContent');
    const uploadForm = document.getElementById('uploadForm');
    const uploadMessageContainer = document.getElementById('uploadMessageContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const creationsList = document.getElementById('creationsList');

    apiKeyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        apiKeyMessageContainer.textContent = 'Weryfikacja klucza...';
        apiKeyMessageContainer.className = 'message';

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            apiKeyMessageContainer.textContent = 'Proszę wprowadzić klucz API.';
            apiKeyMessageContainer.classList.add('error');
            return;
        }

        try {
            const response = await fetch('/verify-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            });

            const result = await response.json();
            
            if (response.ok) {
                apiKeyMessageContainer.textContent = result.message;
                apiKeyMessageContainer.classList.add('success');
                
                apiKeyVerification.style.display = 'none';
                mainContent.style.display = 'block';

                sessionStorage.setItem('apiKey', apiKey);
            } else {
                apiKeyMessageContainer.textContent = result.message;
                apiKeyMessageContainer.classList.add('error');
            }
        } catch (error) {
            apiKeyMessageContainer.textContent = 'Wystąpił nieoczekiwany błąd serwera podczas weryfikacji.';
            apiKeyMessageContainer.classList.add('error');
        }
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadMessageContainer.textContent = 'Przetwarzanie pliku... Proszę czekać.';
        uploadMessageContainer.className = 'message';

        const formData = new FormData(uploadForm);
        const apiKey = sessionStorage.getItem('apiKey');
        formData.append('apiKey', apiKey);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (response.ok) {
                uploadMessageContainer.textContent = result.message;
                uploadMessageContainer.classList.add('success');
                uploadForm.reset();
                
                resultsContainer.style.display = 'block';
                creationsList.innerHTML = '';
                
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
                uploadMessageContainer.textContent = result.message;
                uploadMessageContainer.classList.add('error');
            }
        } catch (error) {
            uploadMessageContainer.textContent = 'Wystąpił nieoczekiwany błąd serwera.';
            uploadMessageContainer.classList.add('error');
        }
    });
});