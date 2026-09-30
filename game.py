"""Pure Python simulation. Coordinates use arena radius = 1, y points down."""
import json
import math
import random

BOSS_RADIUS = 0.46
BAND_WIDTH = 0.5
PLAYER_RADIUS = 0.025
SPEED = 0.55


def band_distance(x, y, angle):
    theta = math.radians(angle)
    return x * math.cos(theta) + y * math.sin(theta)


def inside_band(x, y, angle):
    return -PLAYER_RADIUS <= band_distance(x, y, angle) <= BAND_WIDTH + PLAYER_RADIUS


class Game:
    def __init__(self, rng=None):
        self.rng = rng or random.Random()
        self.reset()

    def reset(self):
        self.x, self.y = 0.0, 0.72
        self.target = None
        self.time = 0.0
        self.running = False
        self.paused = False
        self.hits = []
        self.resolved = 0
        self.angles = []
        self.direction = 1

    def start(self, direction="random"):
        self.reset()
        self.direction = self.rng.choice([-1, 1]) if direction == "random" else (1 if direction == "cw" else -1)
        start = self.rng.choice([45, 135, 225, 315])
        self.angles = [(start + self.direction * i * 90) % 360 for i in range(4)]
        self.running = True

    def move_to(self, x, y):
        limit = 1 - PLAYER_RADIUS
        length = math.hypot(x, y)
        scale = min(1, limit / length) if length else 1
        self.target = (x * scale, y * scale)

    def update(self, dt, dx=0, dy=0):
        if self.paused:
            return
        dt = max(0.0, dt)
        # Substeps keep collision at the actual attack time even for slow frames.
        while dt > 1e-9:
            step = min(dt, 1 / 120)
            dt -= step
            if dx or dy:
                self.target = None
                length = math.hypot(dx, dy)
                strength = min(1.0, length)
                self.x += dx / length * strength * SPEED * step
                self.y += dy / length * strength * SPEED * step
            elif self.target:
                tx, ty = self.target
                length = math.hypot(tx - self.x, ty - self.y)
                if length <= SPEED * step:
                    self.x, self.y = tx, ty
                    self.target = None
                else:
                    self.x += (tx - self.x) / length * SPEED * step
                    self.y += (ty - self.y) / length * SPEED * step
            length = math.hypot(self.x, self.y)
            if length > 1 - PLAYER_RADIUS:
                scale = (1 - PLAYER_RADIUS) / length
                self.x *= scale
                self.y *= scale
            if self.running:
                self.time += step
                # Telegraphs at 0, 1, 2, 3; attacks at 6, 7, 8, 9.
                while self.resolved < 4 and self.time + 1e-9 >= 6 + self.resolved:
                    if inside_band(self.x, self.y, self.angles[self.resolved]):
                        self.hits.append(self.resolved)
                    self.resolved += 1
                if self.time >= 9.65:
                    self.running = False

    def state(self):
        telegraphs = []
        for i, angle in enumerate(self.angles):
            now = self.time + 1e-9
            warning = i <= now < i + 1
            attack = 6 + i <= now < 6 + i + 0.45
            if warning or attack:
                telegraphs.append({"angle": angle, "index": i, "attack": attack})
        if not self.angles:
            phase = "ready"
        elif not self.running:
            phase = "result"
        elif self.time + 1e-9 < 4:
            phase = "telegraph"
        elif self.time < 6:
            phase = "wait"
        else:
            phase = "attack"
        return {"x": self.x, "y": self.y, "target": self.target,
                "time": self.time, "running": self.running, "paused": self.paused,
                "hits": self.hits, "resolved": self.resolved,
                "angles": self.angles, "direction": self.direction,
                "telegraphs": telegraphs, "phase": phase}


game = Game()


def command(action, payload="{}"):
    data = json.loads(payload)
    if action == "start":
        game.start(data.get("direction", "random"))
    elif action == "reset":
        game.reset()
    elif action == "target":
        game.move_to(data["x"], data["y"])
    elif action == "stop":
        game.target = None
    elif action == "pause":
        game.paused = not game.paused
    elif action == "update":
        game.update(data["dt"], data.get("dx", 0), data.get("dy", 0))
    return json.dumps(game.state())
