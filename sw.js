self.addEventListener('push', function(event) {
  let data = { title: 'Trackapp 💊', body: 'Pamiętaj o wzięciu tabletki!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Pamiętaj o wzięciu tabletki!',
    icon: 'https://cdn.jsdelivr.net/gh/TWOJ-USER/TWOJE-REPO@main/icons/icon.png',
    badge: 'https://cdn.jsdelivr.net/gh/TWOJ-USER/TWOJE-REPO@main/icons/icon.png',
    vibrate: [200, 100, 200],
    tag: 'trackapp-pill-reminder',
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      url: './'
    },
    actions: [
      { action: 'open', title: 'Otwórz Trackapp' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Trackapp 💊', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
