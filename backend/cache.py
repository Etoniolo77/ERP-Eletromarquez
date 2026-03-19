import time

class SimpleCache:
    def __init__(self, ttl_seconds=300):
        self._cache = {}
        self.ttl_seconds = ttl_seconds

    def get(self, key):
        if key in self._cache:
            entry = self._cache[key]
            if time.time() - entry['timestamp'] < self.ttl_seconds:
                return entry['data']
            else:
                del self._cache[key]
        return None

    def set(self, key, value):
        self._cache[key] = {
            'data': value,
            'timestamp': time.time()
        }

    def clear(self):
        self._cache.clear()

# Global cache instance for the API
api_cache = SimpleCache(ttl_seconds=300)
