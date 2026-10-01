"""Exaflare circles travelling along the lanes in the reference diagram."""
import json
import math
import random

from game import PLAYER_RADIUS, SPEED

RADIUS = .32
LANES = ((-.55, .55), (-.90, .22), (-.22, .90))
START_DISTANCE = 1 + RADIUS
STEP_DISTANCE = .30
STEPS = math.ceil(2 * START_DISTANCE / STEP_DISTANCE) + 1
COUNTDOWN = 3
WARNING = 4
WAVE_INTERVAL = 2
INTERVAL = .5
BLAST_DURATION = .35


class ExaGame:
    def __init__(self, rng=None):
        self.rng = rng or random.Random()
        self.reset()

    def reset(self):
        self.x, self.y = 0, .65
        self.time = 0
        self.running = self.paused = self.started = False
        self.hits = []
        self.resolved = 0
        self.events = []
        self.patterns = []
        self.interval = INTERVAL
        self.visual_time = 0

    def start(self):
        self.reset()
        self.started = self.running = True
        orders = {axis:self.rng.sample(range(3),3) for axis in ('vertical','horizontal')}
        for wave in range(6):
            axis = 'vertical' if wave % 2 == 0 else 'horizontal'
            index = orders[axis][wave // 2]
            warning_at = COUNTDOWN + wave * WAVE_INTERVAL
            self.patterns.append({'axis':axis,'pattern':index,'warning_at':warning_at,
                                  'start_at':warning_at + WARNING})
            for lane_index, lane in enumerate(LANES[index]):
                for step in range(STEPS):
                    position = -START_DISTANCE + step * STEP_DISTANCE
                    x,y = (lane,position) if axis == 'vertical' else (-position,lane)
                    self.events.append({'id':len(self.events), 'x':x, 'y':y, 'radius':RADIUS,
                                        'step':step, 'axis':axis, 'lane':lane_index, 'wave':wave,
                                        'at':warning_at + WARNING + step * self.interval})
        self.end = max(e['at'] for e in self.events) + BLAST_DURATION

    def update(self, dt, dx=0, dy=0):
        if self.paused:
            return
        while dt > 1e-9:
            step = min(dt,1/120)
            dt -= step
            if self.started:
                self.visual_time += step
            length = math.hypot(dx,dy)
            if length:
                distance = min(1,length) * SPEED * step
                self.x += dx / length * distance
                self.y += dy / length * distance
            distance = math.hypot(self.x,self.y)
            if distance > 1-PLAYER_RADIUS:
                self.x *= (1-PLAYER_RADIUS)/distance
                self.y *= (1-PLAYER_RADIUS)/distance
            if not self.running:
                continue
            self.time = min(self.end,self.time + step)
            now = self.time + 1e-9
            for event in self.events:
                if event['at'] <= now < event['at'] + BLAST_DURATION and event['id'] not in self.hits:
                    if math.hypot(self.x-event['x'],self.y-event['y']) <= RADIUS + PLAYER_RADIUS:
                        self.hits.append(event['id'])
            self.resolved = sum(e['at'] <= now for e in self.events)
            if now >= self.end:
                self.running = False

    def state(self):
        now = self.time + 1e-9
        phase = 'ready' if not self.started else 'countdown' if now < COUNTDOWN else 'warning' if now < COUNTDOWN+WARNING else 'attack' if self.running else 'result'
        circles = []
        for event in self.events:
            warning_start = event['at'] - (WARNING if event['step']==0 else self.interval)
            attack = event['at'] <= now < event['at'] + BLAST_DURATION
            if phase != 'result' and (warning_start <= now < event['at'] or attack):
                circles.append({**event, 'attack':attack})
        revealed = [dict(p, wave=i+1) for i,p in enumerate(self.patterns) if p['warning_at'] <= now]
        return {'mode':'exa', 'x':self.x,'y':self.y,'time':self.time,
                'phase':phase,'running':self.running,'paused':self.paused,'started':self.started,
                'countdown':max(1,math.ceil(COUNTDOWN-now)) if phase=='countdown' else 0,
                'hits':self.hits,'resolved':self.resolved,'total':len(self.events),
                'circles':circles,'patterns':revealed,'interval':self.interval,
                'hit_flash':any(e['id'] in self.hits and 0 <= self.visual_time-e['at'] < .5 for e in self.events),
                'telegraphs':[],'angles':[]}


game = ExaGame()


def command(action,payload='{}'):
    data = json.loads(payload)
    if action == 'start':
        game.start()
    elif action == 'reset':
        game.reset()
    elif action == 'pause':
        game.paused = not game.paused
    elif action == 'update':
        game.update(data['dt'],data.get('dx',0),data.get('dy',0))
    return json.dumps(game.state())
