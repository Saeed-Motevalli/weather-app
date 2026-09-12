const API = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search",
  reverseGeocoding: "https://nominatim.openstreetmap.org/reverse",
  forecast: "https://api.open-meteo.com/v1/forecast",
};

const DEFAULT_CITY = {
  name: "Tehran",
  admin1: "Tehran",
  country: "Iran",
  latitude: 35.6892,
  longitude: 51.389,
};

const STORAGE_KEYS = {
  favorites: "skycast-favorites",
  lastLocation: "skycast-last-location",
  unit: "skycast-unit",
};

const UNIT_PREFERENCE_VERSION = "2";
const UNIT_PREFERENCE_VERSION_KEY = "skycast-unit-preference-version";
const WEATHER_CODES = {
  0: {
    label: "Clear sky",
    theme: "clear",
  },
  1: {
    label: "Mainly clear",
    theme: "clear",
  },
  2: {
    label: "Partly cloudy",
    theme: "clouds",
  },
  3: {
    label: "Overcast",
    theme: "clouds",
  },
  45: {
    label: "Fog",
    theme: "fog",
  },
  48: {
    label: "Depositing rime fog",
    theme: "fog",
  },
  51: {
    label: "Light drizzle",
    theme: "rain",
  },
  53: {
    label: "Drizzle",
    theme: "rain",
  },
  55: {
    label: "Dense drizzle",
    theme: "rain",
  },
  56: {
    label: "Light freezing drizzle",
    theme: "rain",
  },
  57: {
    label: "Freezing drizzle",
    theme: "rain",
  },
  61: {
    label: "Light rain",
    theme: "rain",
  },
  63: {
    label: "Rain",
    theme: "rain",
  },
  65: {
    label: "Heavy rain",
    theme: "rain",
  },
  66: {
    label: "Light freezing rain",
    theme: "rain",
  },
  67: {
    label: "Freezing rain",
    theme: "rain",
  },
  71: {
    label: "Light snow",
    theme: "snow",
  },
  73: {
    label: "Snow",
    theme: "snow",
  },
  75: {
    label: "Heavy snow",
    theme: "snow",
  },
  77: {
    label: "Snow grains",
    theme: "snow",
  },
  80: {
    label: "Light showers",
    theme: "rain",
  },
  81: {
    label: "Showers",
    theme: "rain",
  },
  82: {
    label: "Heavy showers",
    theme: "rain",
  },
  85: {
    label: "Snow showers",
    theme: "snow",
  },
  86: {
    label: "Heavy snow showers",
    theme: "snow",
  },
  95: {
    label: "Thunderstorm",
    theme: "storm",
  },
  96: {
    label: "Thunderstorm with hail",
    theme: "storm",
  },
  99: {
    label: "Thunderstorm with heavy hail",
    theme: "storm",
  },
};
const elements = {
  body: document.body,
  appLoader: document.querySelector("#app-loader"),
  locationName: document.querySelector("#location-name"),
  currentDate: document.querySelector("#current-date"),
  currentIcon: document.querySelector("#current-icon"),
  currentTemperature: document.querySelector("#current-temperature"),
  currentCondition: document.querySelector("#current-condition"),
  highLow: document.querySelector("#high-low"),
  humidity: document.querySelector("#humidity"),
  windSpeed: document.querySelector("#wind-speed"),
  feelsLike: document.querySelector("#feels-like"),
  feelsLikeIcon: document
    .querySelector("#feels-like")
    ?.closest(".metric-card")
    ?.querySelector(".metric-icon"),
  hourlyChart: document.querySelector("#hourly-chart"),
  hourlyList: document.querySelector("#hourly-list"),
  forecastGrid: document.querySelector("#forecast-grid"),
  favoritesList: document.querySelector("#favorites-list"),
  status: document.querySelector("#status-message"),
  toast: document.querySelector("#toast"),
  unitToggle: document.querySelector("#unit-toggle"),
  locationButton: document.querySelector("#location-button"),
  favoriteButton: document.querySelector("#favorite-button"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  suggestions: document.querySelector("#search-suggestions"),
};

function getInitialUnit() {
  try {
    if (
      localStorage.getItem(UNIT_PREFERENCE_VERSION_KEY) !==
      UNIT_PREFERENCE_VERSION
    ) {
      localStorage.removeItem(STORAGE_KEYS.unit);

      localStorage.setItem(
        UNIT_PREFERENCE_VERSION_KEY,
        UNIT_PREFERENCE_VERSION,
      );

      return "celsius";
    }

    return localStorage.getItem(STORAGE_KEYS.unit) === "fahrenheit"
      ? "fahrenheit"
      : "celsius";
  } catch {
    return "celsius";
  }
}

const state = {
  city: null,
  weather: null,
  unit: getInitialUnit(),
  favorites: readStorage(STORAGE_KEYS.favorites, []),
  searchResults: [],
  searchRequestId: 0,
  suggestionController: null,
  searchCache: new Map(),
  toastTimer: null,
  activeRequest: null,
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable.
  }
}

function getWeatherMeta(code, isDay = 1) {
  const fallback = {
    label: "Unknown conditions",
    theme: "clouds",
  };

  const meta = WEATHER_CODES[Number(code)] || fallback;

  return {
    ...meta,
    iconName: getWeatherIconName(code, isDay),
  };
}

function getWeatherIconName(code, isDay = 1) {
  const weatherCode = Number(code);

  if (weatherCode === 0) {
    return isDay ? "clear-day" : "clear-night";
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  }

  if (weatherCode === 3) {
    return "cloudy";
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return "fog";
  }

  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }

  if (
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86)
  ) {
    return "snow";
  }

  if (weatherCode >= 95) {
    return "storm";
  }

  return isDay ? "clear-day" : "clear-night";
}

function weatherIconMarkup(iconName, className) {
  return `
    <img
      class="${className}"
      src="weather-icons/${iconName}.svg"
      alt=""
      draggable="false"
    />
  `;
}

function getTemperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  const converted =
    state.unit === "celsius" ? Number(value) : Number(value) * 1.8 + 32;

  return Math.round(converted);
}

function temperatureWithUnit(value) {
  const temperature = getTemperature(value);

  return temperature === "--" ? temperature : `${temperature}°`;
}

function formatTime(isoTime) {
  if (!isoTime) {
    return "--";
  }

  const timePart = isoTime.split("T")[1] || "";
  const [hours = "00", minutes = "00"] = timePart.split(":");

  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
function isDayTime(time) {
  const { daily } = state.weather;

  const date = time.split("T")[0];

  const sunrise = daily.sunrise.find((item) => item.startsWith(date));

  const sunset = daily.sunset.find((item) => item.startsWith(date));

  if (!sunrise || !sunset) {
    return 1;
  }

  return time >= sunrise && time <= sunset ? 1 : 0;
}
function formatDate(isoTime) {
  if (!isoTime) {
    return "Local time unavailable";
  }

  const [datePart] = isoTime.split("T");
  const date = new Date(`${datePart}T12:00:00`);

  return `${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })} · ${formatTime(isoTime)}`;
}

function formatDay(isoDate, index) {
  if (index === 0) {
    return "Today";
  }

  const date = new Date(`${isoDate}T12:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function locationLabel(location) {
  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

function locationKey(location) {
  if (location.id) {
    return String(location.id);
  }

  return `${location.name}-${Number(location.latitude).toFixed(3)}-${Number(
    location.longitude,
  ).toFixed(3)}`;
}

function setStatus(message = "", isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", isError);
}

function showToast(message) {
  clearTimeout(state.toastTimer);

  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function setLoading(isLoading, message = "Loading weather data…") {
  elements.body.classList.toggle("is-loading", isLoading);

  elements.searchForm.querySelector("button").disabled = isLoading;
  elements.locationButton.disabled = isLoading;

  if (isLoading) {
    if (
      elements.appLoaderMessage &&
      elements.body.classList.contains("app-starting")
    ) {
      elements.appLoaderMessage.textContent = message;
    }

    setStatus(message);
  }
}

function setStartupLoading(isLoading, message = "Checking your location…") {
  elements.body.classList.toggle("app-starting", isLoading);
  elements.body.setAttribute("aria-busy", String(isLoading));

  if (!elements.appLoader) {
    return;
  }

  elements.appLoader.hidden = !isLoading;

  elements.appLoader.setAttribute("aria-hidden", String(!isLoading));

  if (isLoading && elements.appLoaderMessage) {
    elements.appLoaderMessage.textContent = message;
  }
}

async function searchCities(query, signal) {
  const cacheKey = query.trim().toLowerCase();

  if (state.searchCache.has(cacheKey)) {
    return state.searchCache.get(cacheKey);
  }

  const params = new URLSearchParams({
    name: query,
    count: "5",
    language: "en",
    format: "json",
  });

  const response = await fetch(`${API.geocoding}?${params}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("City search failed");
  }

  const data = await response.json();
  const results = data.results || [];

  if (state.searchCache.size >= 20) {
    state.searchCache.delete(state.searchCache.keys().next().value);
  }

  state.searchCache.set(cacheKey, results);

  return results;
}

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    lat: Number(latitude).toFixed(6),
    lon: Number(longitude).toFixed(6),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
    "accept-language": "en",
  });

  const response = await fetch(`${API.reverseGeocoding}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Reverse geocoding failed");
  }

  const data = await response.json();
  const address = data.address || {};

  const name =
    address.city ||
    address.town ||
    address.municipality ||
    address.village ||
    address.county ||
    address.state;

  if (!name) {
    throw new Error("City name was not found");
  }

  return {
    name,
    admin1: address.state || "",
    country: address.country || "",
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

async function getApproximateLocation(savedLocation = null) {
  return savedLocation || DEFAULT_CITY;
}

async function getWeather(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    hourly: "temperature_2m,weather_code",
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(","),
    timezone: "auto",
    forecast_days: "7",
  });

  const response = await fetch(`${API.forecast}?${params}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Weather request failed");
  }

  return response.json();
}

async function loadLocation(location, { announce = true } = {}) {
  if (state.activeRequest) {
    state.activeRequest.abort();
  }

  const request = new AbortController();
  state.activeRequest = request;

  setLoading(
    true,
    announce
      ? `Loading weather for ${location.name}…`
      : "Loading your location…",
  );

  try {
    const weather = await getWeather(
      location.latitude,
      location.longitude,
      request.signal,
    );

    state.city = location;
    state.weather = weather;

    writeStorage(STORAGE_KEYS.lastLocation, location);

    renderApp();

    setStatus(`Updated just now · ${weather.timezone || "local time"}`);
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus("We could not load weather data. Please try again.", true);

      showToast("Weather data is temporarily unavailable.");
    }
  } finally {
    if (state.activeRequest === request) {
      state.activeRequest = null;
      setLoading(false);
    }
  }
}

async function loadCityByName(name) {
  const query = name.trim();

  if (!query) {
    showToast("Type a city name first.");
    return;
  }

  setLoading(true, `Searching for ${query}…`);
  hideSuggestions();

  try {
    const results = await searchCities(query);

    if (!results.length) {
      throw new Error("No city found");
    }

    await loadLocation(results[0]);
    elements.searchInput.value = "";
  } catch {
    setLoading(false);
    setStatus(`No location found for “${query}”.`, true);
    showToast("Try a different city name.");
  }
}

function renderApp() {
  if (!state.city || !state.weather) {
    return;
  }

  renderCurrentWeather();
  renderHourly();
  renderForecast();
  renderFavorites();
  updateUnitButton();
}

function renderCurrentWeather() {
  const { current, daily } = state.weather;
  const meta = getWeatherMeta(current.weather_code, current.is_day);

  Array.from(elements.body.classList).forEach((className) => {
    if (className.startsWith("weather-")) {
      elements.body.classList.remove(className);
    }
  });

  elements.body.classList.add(`weather-${meta.theme}`);

  if (!current.is_day) {
    elements.body.classList.add("weather-night");
  }

  elements.locationName.textContent = state.city.name || "Current location";
  updateLocalClock();
  elements.currentIcon.innerHTML = weatherIconMarkup(
    meta.iconName,
    "current-weather-svg",
  );

  elements.currentIcon.setAttribute("aria-label", meta.label);

  elements.currentTemperature.textContent = getTemperature(
    current.temperature_2m,
  );

  elements.currentCondition.textContent = meta.label;

  elements.highLow.textContent =
    `H ${temperatureWithUnit(daily.temperature_2m_max[0])} · ` +
    `L ${temperatureWithUnit(daily.temperature_2m_min[0])}`;

  elements.humidity.textContent = `${Math.round(
    current.relative_humidity_2m,
  )}%`;

  elements.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;

  elements.feelsLike.textContent = temperatureWithUnit(
    current.apparent_temperature,
  );

  if (elements.feelsLikeIcon) {
    const apparentTemperature = Number(current.apparent_temperature);

    elements.feelsLikeIcon.textContent =
      apparentTemperature > 30 ? "🥵" : apparentTemperature < 12 ? "🥶" : "☺️";
  }

  const favorite = state.favorites.some(
    (item) => locationKey(item) === locationKey(state.city),
  );

  elements.favoriteButton.classList.toggle("is-favorite", favorite);

  elements.favoriteButton.textContent = favorite ? "★" : "☆";

  elements.favoriteButton.setAttribute(
    "aria-label",
    favorite ? "Remove city from favorites" : "Add current city to favorites",
  );

  elements.favoriteButton.title = favorite
    ? "Remove from favorites"
    : "Add to favorites";
}

function getHourlySlice() {
  const { hourly, current } = state.weather;

  let startIndex = hourly.time.findIndex((time) => time >= current.time);

  if (startIndex < 0) {
    startIndex = 0;
  }

  return Array.from({ length: 8 }, (_, index) => {
    const itemIndex = Math.min(startIndex + index * 3, hourly.time.length - 1);

    return {
      time: hourly.time[itemIndex],
      temperature: hourly.temperature_2m[itemIndex],
      code: hourly.weather_code[itemIndex],
      isNow: index === 0,
    };
  });
}

function renderHourly() {
  const items = getHourlySlice();

  elements.hourlyList.replaceChildren();

  items.forEach((item) => {
    const meta = getWeatherMeta(item.code, isDayTime(item.time));
    const card = document.createElement("article");

    card.className = `hour-item${item.isNow ? " is-now" : ""}`;

    card.innerHTML = `
      <span class="hour-time">
        ${item.isNow ? "Now" : formatTime(item.time)}
      </span>

      <span class="hour-icon" aria-hidden="true">
        ${weatherIconMarkup(meta.iconName, "hour-weather-svg")}
      </span>

      <span class="hour-temp">
        ${temperatureWithUnit(item.temperature)}
      </span>
    `;

    elements.hourlyList.append(card);
  });

  drawHourlyChart(items);
}

function drawHourlyChart(items) {
  const width = 720;
  const height = 250;

  const padding = {
    top: 32,
    right: 28,
    bottom: 42,
    left: 30,
  };

  const values = items.map((item) => Number(item.temperature));

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, 4);

  const chartMin = minValue - spread * 0.22;
  const chartMax = maxValue + spread * 0.22;

  const plotWidth = width - padding.left - padding.right;

  const plotHeight = height - padding.top - padding.bottom;

  const xStep = plotWidth / Math.max(items.length - 1, 1);

  const points = items.map((item, index) => {
    const x = padding.left + index * xStep;

    const y =
      padding.top +
      ((chartMax - Number(item.temperature)) / (chartMax - chartMin)) *
        plotHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ` +
        `${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    `${linePath} ` +
    `L ${points.at(-1).x.toFixed(1)} ${height - padding.bottom} ` +
    `L ${points[0].x.toFixed(1)} ${height - padding.bottom} Z`;

  const gridLines = [0.2, 0.5, 0.8]
    .map((ratio) => {
      const y = padding.top + plotHeight * ratio;

      return `
        <line
          class="chart-grid-line"
          x1="${padding.left}"
          x2="${width - padding.right}"
          y1="${y}"
          y2="${y}"
        />
      `;
    })
    .join("");

  const labels = points
    .map(
      (point) => `
        <text
          class="chart-label"
          x="${point.x}"
          y="${height - 14}"
        >
          ${point.isNow ? "Now" : formatTime(point.time)}
        </text>
      `,
    )
    .join("");

  const temperatures = points
    .map(
      (point) => `
        <text
          class="chart-temperature"
          x="${point.x}"
          y="${point.y - 14}"
        >
          ${getTemperature(point.temperature)}°
        </text>
      `,
    )
    .join("");

  const circles = points
    .map(
      (point) => `
        <circle
          class="chart-point"
          cx="${point.x}"
          cy="${point.y}"
          r="5"
        />
      `,
    )
    .join("");

  elements.hourlyChart.innerHTML =
    `${gridLines}` +
    `<path class="chart-area" d="${areaPath}" />` +
    `<path class="chart-path" d="${linePath}" />` +
    `${circles}${temperatures}${labels}`;
}

function renderForecast() {
  const { daily } = state.weather;

  elements.forecastGrid.replaceChildren();

  daily.time.forEach((date, index) => {
    const meta = getWeatherMeta(daily.weather_code[index], 1);

    const card = document.createElement("article");

    card.className = `forecast-card${index === 0 ? " is-today" : ""}`;

    card.innerHTML = `
      <p class="forecast-day">
        ${formatDay(date, index)}
      </p>

      <span class="forecast-icon" aria-hidden="true">
        ${weatherIconMarkup(meta.iconName, "forecast-weather-svg")}
      </span>

      <div class="forecast-temps">
        <span>
          ${temperatureWithUnit(daily.temperature_2m_max[index])}
        </span>

        <span class="forecast-low">
          ${temperatureWithUnit(daily.temperature_2m_min[index])}
        </span>
      </div>

      <p class="rain-chance">
        ${daily.precipitation_probability_max[index] ?? 0}% rain
      </p>
    `;

    elements.forecastGrid.append(card);
  });
}

function renderFavorites() {
  elements.favoritesList.replaceChildren();

  if (!state.favorites.length) {
    const empty = document.createElement("p");

    empty.className = "empty-state";
    empty.textContent = "Your favorite cities will appear here.";

    elements.favoritesList.append(empty);
    return;
  }

  state.favorites.forEach((favorite) => {
    const wrapper = document.createElement("div");

    wrapper.className = "favorite-city-wrapper";

    wrapper.innerHTML = `
      <button
        class="favorite-city"
        type="button"
        data-favorite-key="${locationKey(favorite)}"
      >
        <span>☆</span>
        <span>${locationLabel(favorite)}</span>
      </button>

      <button
        class="favorite-city-remove"
        type="button"
        data-remove-key="${locationKey(favorite)}"
        aria-label="Remove ${locationLabel(favorite)} from favorites"
      >
        ×
      </button>
    `;

    elements.favoritesList.append(wrapper);
  });
}

function updateUnitButton() {
  const isCelsius = state.unit === "celsius";

  elements.unitToggle.textContent = isCelsius ? "°C" : "°F";

  elements.unitToggle.setAttribute(
    "aria-label",
    `Switch to ${isCelsius ? "Fahrenheit" : "Celsius"}`,
  );
}

function hideSuggestions() {
  if (state.suggestionController) {
    state.suggestionController.abort();
    state.suggestionController = null;
  }

  elements.suggestions.hidden = true;
  elements.suggestions.replaceChildren();
  state.searchResults = [];
}

function renderSuggestions(results) {
  state.searchResults = results;
  elements.suggestions.replaceChildren();

  if (!results.length) {
    hideSuggestions();
    return;
  }

  results.forEach((result, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion-item";
    button.dataset.index = index;
    button.setAttribute("role", "option");

    const name = document.createElement("span");

    name.className = "suggestion-name";
    name.textContent = result.name;

    const meta = document.createElement("span");

    meta.className = "suggestion-meta";
    meta.textContent = [result.admin1, result.country]
      .filter(Boolean)
      .join(", ");

    button.append(name, meta);

    button.addEventListener("click", () => {
      selectSuggestion(result);
    });

    elements.suggestions.append(button);
  });

  elements.suggestions.hidden = false;
}

function selectSuggestion(location) {
  elements.searchInput.value = "";
  hideSuggestions();
  loadLocation(location);
}

function debounce(callback, delay = 350) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

const updateSuggestions = debounce(async (value) => {
  const query = value.trim();

  if (query.length < 3) {
    hideSuggestions();
    return;
  }

  const requestId = ++state.searchRequestId;
  const controller = new AbortController();

  state.suggestionController = controller;

  try {
    const results = await searchCities(query, controller.signal);

    if (
      requestId === state.searchRequestId &&
      elements.searchInput.value.trim() === query
    ) {
      renderSuggestions(results);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      hideSuggestions();
    }
  } finally {
    if (state.suggestionController === controller) {
      state.suggestionController = null;
    }
  }
}, 550);

function requestCurrentLocation({ startup = false } = {}) {
  if (!navigator.geolocation) {
    if (startup) {
      return loadLocation(DEFAULT_CITY, {
        announce: false,
      });
    }

    showToast("GPS is not supported. Estimating your location…");

    return loadApproximateLocation();
  }

  if (!startup) {
    setLoading(true, "Finding your location…");
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await loadDetectedLocation(coords);
        } catch {
          if (startup) {
            await loadLocation(DEFAULT_CITY, {
              announce: false,
            });
          } else {
            await loadApproximateLocation();
          }
        } finally {
          resolve();
        }
      },
      async () => {
        try {
          if (startup) {
            showToast("Location permission denied. Showing Tehran.");

            await loadLocation(DEFAULT_CITY, {
              announce: false,
            });
          } else {
            const saved = readStorage(STORAGE_KEYS.lastLocation, null);

            showToast(
              "Location permission was unavailable. Estimating your city…",
            );

            await loadApproximateLocation(saved);
          }
        } finally {
          resolve();
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 600000,
      },
    );
  });
}

async function loadDetectedLocation(coords) {
  const { latitude, longitude } = coords;

  setLoading(true, "Identifying your city…");

  try {
    const location = await reverseGeocode(latitude, longitude);

    await loadLocation(location, {
      announce: false,
    });
  } catch {
    await loadLocation(
      {
        name: "Your location",
        latitude,
        longitude,
      },
      {
        announce: false,
      },
    );
  }
}

async function loadApproximateLocation(savedLocation = null) {
  setLoading(true, "Estimating your location…");

  try {
    const location = await getApproximateLocation(savedLocation);

    await loadLocation(location, {
      announce: false,
    });
  } catch {
    if (savedLocation) {
      await loadLocation(savedLocation, {
        announce: false,
      });
    } else {
      setLoading(false);

      elements.locationName.textContent = "Search for a city";

      elements.currentCondition.textContent = "Location unavailable";

      setStatus("Allow location access or search for a city manually.", true);
    }
  }
}
function toggleFavorite() {
  if (!state.city) return;

  const key = locationKey(state.city);

  const existingIndex = state.favorites.findIndex(
    (item) => locationKey(item) === key,
  );

  if (existingIndex >= 0) {
    state.favorites.splice(existingIndex, 1);
    showToast(`${state.city.name} removed from favorites.`);
  } else {
    state.favorites.unshift({
      ...state.city,
    });

    state.favorites = state.favorites.slice(0, 6);
    showToast(`${state.city.name} added to favorites.`);
  }

  writeStorage(STORAGE_KEYS.favorites, state.favorites);

  // فقط بخش Favorite را به‌روزرسانی کن
  renderFavorites();

  // فقط ظاهر ستاره را به‌روزرسانی کن
  if (state.weather) {
    const isFavorite = state.favorites.some(
      (item) => locationKey(item) === locationKey(state.city),
    );

    elements.favoriteButton.classList.toggle("is-favorite", isFavorite);
    elements.favoriteButton.textContent = isFavorite ? "★" : "☆";
    elements.favoriteButton.setAttribute(
      "aria-label",
      isFavorite
        ? "Remove city from favorites"
        : "Add current city to favorites",
    );
  }
}
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCityByName(elements.searchInput.value);
});

elements.searchInput.addEventListener("input", (event) => {
  hideSuggestions();
  updateSuggestions(event.target.value);
});

elements.favoritesList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-key]");

  if (removeButton) {
    state.favorites = state.favorites.filter(
      (item) => locationKey(item) !== removeButton.dataset.removeKey,
    );

    writeStorage(STORAGE_KEYS.favorites, state.favorites);

    renderFavorites();

    if (state.city && state.weather) {
      const isFavorite = state.favorites.some(
        (item) => locationKey(item) === locationKey(state.city),
      );

      elements.favoriteButton.classList.toggle("is-favorite", isFavorite);
      elements.favoriteButton.textContent = isFavorite ? "★" : "☆";
    }
    showToast("City removed from favorites.");
    return;
  }

  const favoriteButton = event.target.closest("[data-favorite-key]");

  if (favoriteButton) {
    const favorite = state.favorites.find(
      (item) => locationKey(item) === favoriteButton.dataset.favoriteKey,
    );

    if (favorite) {
      loadLocation(favorite);
    }
  }
});

elements.favoriteButton.addEventListener("click", toggleFavorite);

elements.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";

  writeStorage(STORAGE_KEYS.unit, state.unit);

  if (state.weather) {
    renderApp();
  }
});

elements.locationButton.addEventListener("click", requestCurrentLocation);

document.addEventListener("click", (event) => {
  if (!elements.searchForm.contains(event.target)) {
    hideSuggestions();
  }
});

async function startApp() {
  setStartupLoading(true, "Checking your location…");

  renderFavorites();
  updateUnitButton();

  try {
    await requestCurrentLocation({
      startup: true,
    });

    if (!state.city || !state.weather) {
      await loadLocation(DEFAULT_CITY, {
        announce: false,
      });
    }
  } catch {
    await loadLocation(DEFAULT_CITY, {
      announce: false,
    });
  } finally {
    setStartupLoading(false);
  }
}

startApp();

const sections = document.querySelectorAll("section");

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
    }
  });
});

sections.forEach((section) => {
  observer.observe(section);
});

function updateLocalClock() {
  if (!state.weather) return;

  const timezone = state.weather.timezone;

  const now = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  elements.currentDate.textContent = now;
}

setInterval(updateLocalClock, 1000);
