document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const messageContainer = document.getElementById('messageContainer');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageContainer.textContent = 'Przetwarzanie pliku... Proszę czekać.';
        messageContainer.className = 'message';

        const formData = new FormData(form);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (response.ok) {
                messageContainer.textContent = result.message;
                messageContainer.classList.add('success');
            } else {
                messageContainer.textContent = result.message;
                messageContainer.classList.add('error');
            }
        } catch (error) {
            messageContainer.textContent = 'Wystąpił nieoczekiwany błąd serwera.';
            messageContainer.classList.add('error');
        }
    });
});