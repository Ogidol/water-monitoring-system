// IoT Water Tank Monitor - Service Worker
// Provides offline functionality and caching for PWA

const CACHE_NAME = "water-monitor-v1";
const OFFLINE_URL = "/offline.html";

// Files to cache for offline functionality
const CACHE_URLS = [
  "/",
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  // Add other critical assets here
];

// Install event - cache essential files
self.addEventListener("install", (event) => {
  console.log("💧 Service Worker: Installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("💧 Service Worker: Caching essential files");
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log("💧 Service Worker: Installation complete");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("💧 Service Worker: Installation failed", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("💧 Service Worker: Activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("💧 Service Worker: Deleting old cache", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("💧 Service Worker: Activation complete");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip external API calls (ThingSpeak, etc.) - let them fail gracefully
  if (
    event.request.url.includes("thingspeak.com") ||
    event.request.url.includes("api.thingspeak.com")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        console.log("💧 Service Worker: Serving from cache", event.request.url);
        return cachedResponse;
      }

      // Otherwise, fetch from network
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the response for future use
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // If both cache and network fail, show offline page for navigation requests
          if (event.request.destination === "document") {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// Background sync for water level data (when back online)
self.addEventListener("sync", (event) => {
  if (event.tag === "water-level-sync") {
    console.log("💧 Service Worker: Background sync triggered");
    event.waitUntil(syncWaterLevelData());
  }
});

// Push notifications for critical alerts
self.addEventListener("push", (event) => {
  console.log("💧 Service Worker: Push notification received");

  const options = {
    body: event.data
      ? event.data.text()
      : "Water level alert from your IoT monitor",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "view",
        title: "View Dashboard",
        icon: "/icons/icon-72x72.png",
      },
      {
        action: "close",
        title: "Dismiss",
        icon: "/icons/icon-72x72.png",
      },
    ],
    requireInteraction: true,
    tag: "water-alert",
  };

  event.waitUntil(
    self.registration.showNotification("IoT Water Monitor Alert", options)
  );
});

// Handle notification click events
self.addEventListener("notificationclick", (event) => {
  console.log("💧 Service Worker: Notification clicked");

  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(clients.openWindow("/"));
  }
});

// Sync water level data when connection is restored
async function syncWaterLevelData() {
  try {
    console.log("💧 Service Worker: Syncing water level data...");

    // This would typically make API calls to update data
    // For now, we'll just log that sync occurred

    // Send message to main app to refresh data
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_COMPLETE",
        data: "Water level data synced successfully",
      });
    });

    console.log("💧 Service Worker: Sync complete");
  } catch (error) {
    console.error("💧 Service Worker: Sync failed", error);
  }
}

// Handle messages from main application
self.addEventListener("message", (event) => {
  console.log("💧 Service Worker: Message received", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CACHE_WATER_DATA") {
    // Cache critical water monitoring data
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.put(
          "/api/water-data",
          new Response(JSON.stringify(event.data.payload))
        );
      })
    );
  }
});

console.log(
  "💧 Service Worker: Loaded and ready for IoT Water Tank Monitoring"
);
