"""Three Stars tower allocation, movement, timeline, and attack judgments."""
import math
import json
import random

from game import PLAYER_RADIUS, SPEED

COUNTDOWN_END = 3.0
FIRST_PHASE_START = 6.0
PHASE_DURATION = 7.0
PHASE_STARTS = tuple(FIRST_PHASE_START + i * PHASE_DURATION for i in range(3))
PHASE_CHECKS = tuple(start + PHASE_DURATION for start in PHASE_STARTS)
ELEMENTS = ("fire", "lightning", "ice")
TOWER_DISTANCE = .70
TOWER_RADIUS = .12


def timeline_at(elapsed):
    """Times are measured from pressing Start; checks happen at 13/20/27s."""
    now = max(0.0, elapsed) + 1e-9
    if now < COUNTDOWN_END:
        return {"phase": "countdown", "wave": 0,
                "countdown": max(1, math.ceil(COUNTDOWN_END - now)),
                "remaining": max(0.0, COUNTDOWN_END - elapsed)}
    if now < FIRST_PHASE_START:
        return {"phase": "preparation", "wave": 0, "countdown": 0,
                "remaining": max(0.0, FIRST_PHASE_START - elapsed)}
    for i, check in enumerate(PHASE_CHECKS):
        if now < check:
            return {"phase": "towers", "wave": i + 1, "countdown": 0,
                    "remaining": max(0.0, check - elapsed)}
    return {"phase": "result", "wave": 3, "countdown": 0, "remaining": 0.0}


def due_checks(previous, current):
    """Return every crossed judgment, including when a slow frame spans waves."""
    return [i for i, check in enumerate(PHASE_CHECKS)
            if previous + 1e-9 < check <= current + 1e-9]


class ThreeStarsGame:
    def __init__(self, rng=None):
        self.rng = rng or random.Random()
        self.reset()

    def reset(self):
        self.x, self.y = 0.0, .45
        self.time = 0.0
        self.running = self.paused = self.started = False
        self.initial_debuff = self.debuff = None
        self.results = []
        self.hits = []
        self.resolved = 0
        self.extra_elements = []
        self.patterns = []
        self.effects = []
        self.active_wave = 0
        self.expected_tower = None
        self.towers = self.make_towers(0)

    def make_towers(self, rotation):
        towers = []
        # Three contiguous towers per attribute, in clockwise groups.
        for i in range(9):
            angle = math.radians(-90 + i * 40 + rotation)
            towers.append({"id": i, "element": ELEMENTS[i // 3],
                           "x": math.cos(angle) * TOWER_DISTANCE,
                           "y": math.sin(angle) * TOWER_DISTANCE,
                           "radius": TOWER_RADIUS})
        return towers

    def start(self, debuff="random", attack="random"):
        self.reset()
        self.started = self.running = True
        self.initial_debuff = self.rng.choice([None, *ELEMENTS]) if debuff == "random" else (None if debuff == "none" else debuff)
        self.towers = self.make_towers(self.rng.randrange(9) * 40)
        self.extra_elements = self.rng.sample(list(ELEMENTS), 3)
        for extra in self.extra_elements:
            active = []
            for element in ELEMENTS:
                ids = [tower["id"] for tower in self.towers if tower["element"] == element]
                active.extend(self.rng.sample(ids, 2 if element == extra else 1))
            self.patterns.append(sorted(active))
        self.effects = [self.rng.choice(["earth", "wind"]) if attack == "random" else attack,
                        None, self.rng.choice(["earth", "wind"]) if attack == "random" else attack]

    def target_for(self, wave, debuff):
        active = self.patterns[wave]
        if debuff is None:
            return max(i for i in active if self.towers[i]["element"] == self.extra_elements[wave])
        # The rear tower is the departure reference if one's own attribute is doubled.
        reference = max(i for i in active if self.towers[i]["element"] == debuff)
        return active[(active.index(reference) + 1) % len(active)]

    def begin_wave(self, wave):
        self.active_wave = wave + 1
        self.expected_tower = self.target_for(wave, self.debuff)

    def check(self, wave):
        active = self.patterns[wave]
        occupied = next((i for i in active if math.hypot(self.x - self.towers[i]["x"], self.y - self.towers[i]["y"]) <= TOWER_RADIUS - PLAYER_RADIUS + 1e-9), None)
        tower_ok = occupied == self.expected_tower
        distance = math.hypot(self.x, self.y)
        effect = self.effects[wave]
        boss_hit = effect == "earth" and distance <= TOWER_DISTANCE + PLAYER_RADIUS
        boss_hit |= effect == "wind" and distance >= TOWER_DISTANCE - PLAYER_RADIUS
        reasons = []
        if not tower_ok:
            reasons.append("no_tower" if occupied is None else "wrong_tower")
        if boss_hit:
            reasons.append(effect)
        if reasons:
            self.hits.append(wave)
        self.results.append({"wave": wave + 1, "success": not reasons,
                             "expected": self.expected_tower, "occupied": occupied,
                             "effect": effect, "reasons": reasons})
        self.resolved += 1
        if self.initial_debuff is not None and occupied is not None:
            self.debuff = self.towers[occupied]["element"]

    def update(self, dt, dx=0, dy=0):
        if self.paused:
            return
        dt = max(0.0, dt)
        while dt > 1e-9:
            step = min(dt, 1 / 120)
            dt -= step
            if dx or dy:
                length = math.hypot(dx, dy)
                speed = SPEED * min(1.0, length) * step
                self.x += dx / length * speed
                self.y += dy / length * speed
            length = math.hypot(self.x, self.y)
            if length > 1 - PLAYER_RADIUS:
                self.x *= (1 - PLAYER_RADIUS) / length
                self.y *= (1 - PLAYER_RADIUS) / length
            if not self.running:
                continue
            previous = self.time
            self.time = min(PHASE_CHECKS[-1], self.time + step)
            if previous + 1e-9 < COUNTDOWN_END <= self.time + 1e-9:
                self.debuff = self.initial_debuff
            if self.active_wave == 0 and self.time + 1e-9 >= FIRST_PHASE_START:
                self.begin_wave(0)
            for wave in due_checks(previous, self.time):
                self.check(wave)
                if wave < 2:
                    self.begin_wave(wave + 1)
                else:
                    self.running = False

    def state(self):
        info = timeline_at(self.time) if self.started else {"phase": "ready", "wave": 0, "countdown": 0, "remaining": 0}
        active = self.patterns[info["wave"] - 1] if info["phase"] == "towers" else []
        effect = self.effects[info["wave"] - 1] if active else None
        # Show a short attack flash after phase 1 and at the final result.
        flash = None
        for wave, result in enumerate(self.results):
            if PHASE_CHECKS[wave] <= self.time + 1e-9 < PHASE_CHECKS[wave] + .4:
                flash = result["effect"]
        return {**info, "mode": "three-stars", "x": self.x, "y": self.y,
                "time": self.time, "running": self.running, "paused": self.paused,
                "started": self.started, "debuff": self.debuff,
                "debuff_assigned": self.started and self.time + 1e-9 >= COUNTDOWN_END,
                "resolved": self.resolved, "hits": self.hits, "results": self.results,
                "towers": [{**tower, "active": tower["id"] in active, "used": False} for tower in self.towers],
                "boss_effect": effect, "boss_flash": flash,
                "telegraphs": [], "angles": []}


game = ThreeStarsGame()


def command(action, payload="{}"):
    data = json.loads(payload)
    if action == "start":
        game.start(data.get("debuff", "random"), data.get("attack", "random"))
    elif action == "reset":
        game.reset()
    elif action == "pause":
        game.paused = not game.paused
    elif action == "update":
        game.update(data["dt"], data.get("dx", 0), data.get("dy", 0))
    return json.dumps(game.state())
