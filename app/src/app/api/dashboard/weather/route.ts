/**
 * GET /api/dashboard/weather
 * Proxies weather data to the client.
 * Replaces aquaticpro_get_weather() from api-routes-dashboard.php.
 *
 * Uses:
 *   - OpenStreetMap Nominatim for zip-to-lat/lon geocoding (free, no key)
 *   - Open-Meteo for weather data (free, no key)
 *   - Upstash Redis for caching (30 min weather, 7 day geocode)
 *
 * Params:
 *   zip  — US zip code (required)
 */
import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getRedis } from "@/lib/cache/redis";
import { ok, badRequest, serverError } from "@/lib/utils/api-helpers";

// WMO weather code → human-readable condition
const WMO_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Heavy drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight showers",
  81: "Moderate showers",
  82: "Violent showers",
  95: "Thunderstorm",
  99: "Thunderstorm with hail",
};

interface GeoCache {
  lat: number;
  lon: number;
  city: string;
}

interface WeatherCache {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  city: string;
  zip: string;
  fetchedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const [, authErr] = await requireSession();
    if (authErr) return authErr;

    const zip = new URL(request.url).searchParams.get("zip")?.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      return badRequest("zip must be a 5-digit US zip code");
    }

    // Check weather cache first (30 min TTL)
    const weatherCacheKey = `weather:${zip}`;
    const redis = getRedis();
    const cached = redis ? await redis.get<WeatherCache>(weatherCacheKey) : null;
    if (cached) return ok(cached);

    // Step 1 — Geocode (cached 7 days)
    const geoCacheKey = `geo:zip:${zip}`;
    let geo = redis ? await redis.get<GeoCache>(geoCacheKey) : null;

    if (!geo) {
      const geoUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
      const geoRes = await fetch(geoUrl, {
        headers: { "User-Agent": "AquaticPro/1.0 (contact@aquaticpro.app)" },
        signal: AbortSignal.timeout(8_000),
      });

      if (!geoRes.ok) {
        return ok({
          error: "Geocoding service unavailable",
          temperature: null,
          condition: null,
        });
      }

      const geoData = await geoRes.json();
      if (!geoData?.length) {
        return badRequest(`Could not locate zip code ${zip}`);
      }

      geo = {
        lat: parseFloat(geoData[0].lat),
        lon: parseFloat(geoData[0].lon),
        city: geoData[0].display_name?.split(",")[0] ?? zip,
      };

      if (redis) await redis.set(geoCacheKey, geo, { ex: 60 * 60 * 24 * 7 });
    }

    // Step 2 — Fetch weather from Open-Meteo (no API key required)
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${geo.lat}&longitude=${geo.lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York`;

    const weatherRes = await fetch(weatherUrl, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!weatherRes.ok) {
      return ok({
        error: "Weather service unavailable",
        temperature: null,
        condition: null,
      });
    }

    const weatherData = await weatherRes.json();
    const cur = weatherData?.current;

    const result: WeatherCache = {
      temperature: Math.round(cur?.temperature_2m ?? 0),
      humidity: Math.round(cur?.relative_humidity_2m ?? 0),
      windSpeed: Math.round(cur?.wind_speed_10m ?? 0),
      weatherCode: cur?.weather_code ?? 0,
      condition: WMO_LABELS[cur?.weather_code ?? 0] ?? "Unknown",
      city: geo.city,
      zip,
      fetchedAt: new Date().toISOString(),
    };

    // Cache weather for 30 minutes
    if (redis) await redis.set(weatherCacheKey, result, { ex: 60 * 30 });

    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
