// Bayanihan Connect — Frontend Configuration
// This file should be included in all HTML pages BEFORE api.js

(function() {
  // Set API base URL from environment or default to localhost
  window.API_BASE_URL = 
    localStorage.getItem('api_base_url') ||
    document.currentScript?.dataset?.apiUrl ||
    'http://localhost:5000/api';
})();
