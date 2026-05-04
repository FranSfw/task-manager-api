// --- 1. MOCK OBSERVABLE PATTERN ---
class SimpleObservable {
    constructor(executionFunction) {
        this.executionFunction = executionFunction;
    }

    subscribe({ next, error }) {
        this.executionFunction(next, error);
    }

    static of(data) {
        return new SimpleObservable((next) => next(data));
    }
}

// --- 2. INTERCEPTOR & HTTP CLIENT ---
class LoggingInterceptor {
    static intercept(url, options) {
        console.log(`[HTTP Request] ${new Date().toISOString()} - URL: ${url}`);
        return { url, options };
    }
}

class WeatherHttpClient {
    get(url) {
        const { url: interceptedUrl, options } = LoggingInterceptor.intercept(url, {});
        
        return new SimpleObservable(async (next, error) => {
            try {
                const response = await fetch(interceptedUrl);
                if (!response.ok) throw new Error('Error en la red o ciudad no encontrada');
                const data = await response.json();
                next(data);
            } catch (err) {
                if (error) error(err);
                else console.error('Unhandled HTTP Error:', err);
            }
        });
    }
}

// --- 3. CUSTOM PIPES (Formatters) ---
const pipes = {
    // Aunque OpenMeteo ya da Celsius, cumplimos con el requerimiento de conversión
    kelvinToCelsius: (k) => (k - 273.15).toFixed(1),
    
    // Conversión Celsius a Fahrenheit
    cToF: (c) => (c * 9/5) + 32,

    formatTemp: (temp, unit) => {
        const value = unit === 'F' ? pipes.cToF(temp) : temp;
        return Math.round(value);
    },
    
    weatherCodeToIcon: (code) => {
        const map = {
            0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
            45: '🌫️', 48: '🌫️',
            51: '🌧️', 53: '🌧️', 55: '🌧️',
            61: '🌧️', 63: '🌧️', 65: '🌧️',
            71: '❄️', 73: '❄️', 75: '❄️',
            80: '🌦️', 81: '🌦️', 82: '🌦️',
            95: '⛈️', 96: '⛈️', 99: '⛈️'
        };
        return map[code] || '❓';
    },
    
    weatherCodeToDesc: (code) => {
        const map = {
            0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
            45: 'Niebla', 48: 'Niebla persistente',
            51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
            61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
            71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve fuerte',
            80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
            95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte'
        };
        return map[code] || 'Desconocido';
    },

    formatDay: (dateStr) => {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const date = new Date(dateStr);
        return days[date.getUTCDay()];
    }
};

// --- 4. WEATHER SERVICE ---
class WeatherService {
    constructor() {
        this.http = new WeatherHttpClient();
        this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
        this.geoUrl = 'https://geocoding-api.open-meteo.com/v1/search';
    }

    searchCity(name) {
        const url = `${this.geoUrl}?name=${encodeURIComponent(name)}&count=5&language=es&format=json`;
        return this.http.get(url);
    }

    getWeather(lat, lon) {
        const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
        return this.http.get(url);
    }
}

// --- 5. APP LOGIC (UI CONTROLLER) ---
class WeatherApp {
    constructor() {
        this.service = new WeatherService();
        this.cacheKey = 'weather_recent_searches';
        this.unit = 'C'; // 'C' or 'F'
        this.currentCityData = null;
        this.currentWeatherData = null;
        
        // UI Elements
        this.cityInput = document.getElementById('cityInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.autocompleteList = document.getElementById('autocompleteList');
        this.errorMsg = document.getElementById('errorMsg');
        this.errorText = document.getElementById('errorText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.weatherContent = document.getElementById('weatherContent');
        this.recentSection = document.getElementById('recentSection');
        this.recentTags = document.getElementById('recentTags');
        
        // Temperature Elements
        this.wTemp = document.getElementById('wTemp');
        this.wUnitLabel = document.getElementById('wUnitLabel');
        this.unitToggleBtn = document.getElementById('unitToggleBtn');
        
        this.init();
    }

    init() {
        this.checkAuth();

        // Event Listeners
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.cityInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.handleSearch());
        this.cityInput.addEventListener('input', (e) => this.handleAutocomplete(e.target.value));
        
        if (this.unitToggleBtn) {
            this.unitToggleBtn.addEventListener('click', () => this.toggleUnit());
        }
        
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Close autocomplete on click outside
        document.addEventListener('click', (e) => {
            if (!this.cityInput.contains(e.target) && !this.autocompleteList.contains(e.target)) {
                this.autocompleteList.classList.add('hidden');
            }
        });

        this.renderRecent();
    }

    async checkAuth() {
        try {
            const response = await fetch('/me', { credentials: 'include' });
            if (response.status === 401 || response.status === 403) {
                window.location.replace('login.html');
                return;
            }
            const user = await response.json();
            document.getElementById('currentUserDisplay').textContent = `@${user.username}`;
            document.getElementById('appContainer').classList.remove('hidden');
            document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (error) {
            console.error('Error de autenticación:', error);
            window.location.replace('login.html');
        }
    }

    async logout() {
        try {
            await fetch('/logout', { method: 'POST', credentials: 'include' });
            window.location.replace('login.html');
        } catch (error) {
            console.error('Error al cerrar sesión', error);
        }
    }

    toggleUnit() {
        this.unit = this.unit === 'C' ? 'F' : 'C';
        this.unitToggleBtn.textContent = `Cambiar a °${this.unit === 'C' ? 'F' : 'C'}`;
        this.wUnitLabel.textContent = `°${this.unit}`;
        
        if (this.currentCityData && this.currentWeatherData) {
            this.renderWeather(this.currentCityData, this.currentWeatherData);
        }
    }

    handleAutocomplete(query) {
        if (query.length < 3) {
            this.autocompleteList.classList.add('hidden');
            return;
        }

        this.service.searchCity(query).subscribe({
            next: (data) => {
                this.autocompleteList.innerHTML = '';
                if (data.results && data.results.length > 0) {
                    data.results.forEach(city => {
                        const li = document.createElement('li');
                        li.className = 'px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-none transition-colors text-sm';
                        li.innerHTML = `
                            <div class="flex items-center justify-between">
                                <div>
                                    <span class="font-medium text-gray-900">${city.name}</span>
                                    <span class="text-gray-400 text-xs ml-2">${city.admin1 || ''}, ${city.country}</span>
                                </div>
                                <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase">${city.country_code}</span>
                            </div>
                        `;
                        li.addEventListener('click', () => {
                            this.cityInput.value = city.name;
                            this.autocompleteList.classList.add('hidden');
                            this.fetchWeather(city);
                        });
                        this.autocompleteList.appendChild(li);
                    });
                    this.autocompleteList.classList.remove('hidden');
                } else {
                    this.autocompleteList.classList.add('hidden');
                }
            },
            error: () => this.autocompleteList.classList.add('hidden')
        });
    }

    handleSearch() {
        const query = this.cityInput.value.trim();
        if (!query) return;
        
        this.setLoading(true);
        this.service.searchCity(query).subscribe({
            next: (data) => {
                if (data.results && data.results.length > 0) {
                    this.fetchWeather(data.results[0]);
                } else {
                    this.showError('No se encontró la ciudad especificada.');
                    this.setLoading(false);
                }
            },
            error: (err) => {
                this.showError('Sin conexión o error en la búsqueda.');
                this.setLoading(false);
            }
        });
    }

    fetchWeather(city) {
        this.setLoading(true);
        this.errorMsg.classList.add('hidden');
        
        this.service.getWeather(city.latitude, city.longitude).subscribe({
            next: (data) => {
                this.currentCityData = city;
                this.currentWeatherData = data;
                this.renderWeather(city, data);
                this.saveToCache(city);
                this.setLoading(false);
            },
            error: (err) => {
                this.showError('Error al obtener datos meteorológicos.');
                this.setLoading(false);
            }
        });
    }

    renderWeather(city, data) {
        const current = data.current;
        const daily = data.daily;

        // Current Card
        document.getElementById('wCity').textContent = city.name;
        document.getElementById('wCountry').textContent = `${city.admin1 ? city.admin1 + ', ' : ''}${city.country}`;
        this.wTemp.textContent = pipes.formatTemp(current.temperature_2m, this.unit);
        document.getElementById('wIcon').textContent = pipes.weatherCodeToIcon(current.weather_code);
        document.getElementById('wDesc').textContent = pipes.weatherCodeToDesc(current.weather_code);
        
        document.getElementById('wFeelsLike').textContent = `${pipes.formatTemp(current.apparent_temperature, this.unit)}°`;
        document.getElementById('wHumidity').textContent = `${current.relative_humidity_2m}%`;
        document.getElementById('wWind').textContent = `${current.wind_speed_10m} km/h`;
        document.getElementById('wRain').textContent = `${current.precipitation} mm`;

        // Forecast
        const grid = document.getElementById('forecastGrid');
        grid.innerHTML = '';
        
        // Skip today (index 0) and take next 5 days
        for (let i = 1; i <= 5; i++) {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-100 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors shadow-sm';
            card.innerHTML = `
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">${pipes.formatDay(daily.time[i])}</p>
                <div class="text-3xl mb-2">${pipes.weatherCodeToIcon(daily.weather_code[i])}</div>
                <div class="flex flex-col">
                    <span class="text-base font-bold text-gray-900">${pipes.formatTemp(daily.temperature_2m_max[i], this.unit)}°</span>
                    <span class="text-xs text-gray-400">${pipes.formatTemp(daily.temperature_2m_min[i], this.unit)}°</span>
                </div>
                ${daily.precipitation_sum[i] > 0 ? `<p class="text-[9px] text-blue-500 mt-2 font-medium">💧 ${daily.precipitation_sum[i]}mm</p>` : ''}
            `;
            grid.appendChild(card);
        }

        this.weatherContent.classList.remove('hidden');
    }

    saveToCache(city) {
        let recent = JSON.parse(localStorage.getItem(this.cacheKey)) || [];
        // Remove duplicate if exists
        recent = recent.filter(c => c.id !== city.id);
        // Add to front
        recent.unshift(city);
        // Keep only 5
        recent = recent.slice(0, 5);
        localStorage.setItem(this.cacheKey, JSON.stringify(recent));
        this.renderRecent();
    }

    renderRecent() {
        const recent = JSON.parse(localStorage.getItem(this.cacheKey)) || [];
        if (recent.length === 0) {
            this.recentSection.classList.add('hidden');
            return;
        }

        this.recentTags.innerHTML = '';
        recent.forEach(city => {
            const tag = document.createElement('button');
            tag.className = 'bg-gray-50 border border-gray-200 hover:border-gray-900 px-3 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all flex items-center gap-2';
            tag.innerHTML = `<span>📍</span> ${city.name}`;
            tag.addEventListener('click', () => {
                this.cityInput.value = city.name;
                this.fetchWeather(city);
            });
            this.recentTags.appendChild(tag);
        });
        this.recentSection.classList.remove('hidden');
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingSpinner.classList.remove('hidden');
            this.weatherContent.classList.add('hidden');
            this.errorMsg.classList.add('hidden');
        } else {
            this.loadingSpinner.classList.add('hidden');
        }
    }

    showError(msg) {
        this.errorText.textContent = msg;
        this.errorMsg.classList.remove('hidden');
        this.errorMsg.classList.add('flex');
    }
}

// Start the app
new WeatherApp();
