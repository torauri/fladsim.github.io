import math
import random
import unittest
from exa import LANES, RADIUS, START_DISTANCE, STEPS, ExaGame

class ExaTests(unittest.TestCase):
    def test_effect_trails_one_circle_but_damage_and_warning_stay_in_place(self):
        game=ExaGame(random.Random(3)); game.start()
        game.update(3)
        for circle in game.state()['circles']:
            self.assertEqual((circle['effect_x'],circle['effect_y']),(circle['x'],circle['y']))
        for wave in (0,1):
            event=next(e for e in game.events if e['wave']==wave and e['step']==4 and e['lane']==0)
            game.update(event['at']-game.time)
            circle=next(c for c in game.state()['circles'] if c['id']==event['id'])
            dx=.3 if event['axis']=='horizontal' else 0
            dy=-.3 if event['axis']=='vertical' else 0
            self.assertAlmostEqual(circle['effect_x'],event['x']+dx)
            self.assertAlmostEqual(circle['effect_y'],event['y']+dy)
            game.x,game.y=event['x'],event['y']
            game.update(.01)
            self.assertIn(event['id'],game.hits)

    def test_six_waves_direction_patterns_and_timing(self):
        orders=set()
        for seed in range(30):
            game=ExaGame(random.Random(seed))
            game.start()
            self.assertEqual([p['axis'] for p in game.patterns],['vertical','horizontal']*3)
            self.assertEqual([p['warning_at'] for p in game.patterns],[3,5,7,9,11,13])
            self.assertEqual([p['start_at'] for p in game.patterns],[6,8,10,12,14,16])
            for axis in ('vertical','horizontal'):
                order=tuple(p['pattern'] for p in game.patterns if p['axis']==axis)
                self.assertEqual(set(order),{0,1,2})
                orders.add(order)
            for wave,pattern in enumerate(game.patterns):
                events=[e for e in game.events if e['wave']==wave]
                self.assertEqual(len(events),STEPS*2)
                coordinate='x' if pattern['axis']=='vertical' else 'y'
                self.assertEqual({e[coordinate] for e in events},set(LANES[pattern['pattern']]))
                self.assertAlmostEqual(events[1]['at']-events[0]['at'],.4)
                if pattern['axis']=='horizontal':
                    self.assertAlmostEqual(events[0]['x']-RADIUS,1)
                    self.assertGreater(events[0]['x'],events[-1]['x'])
                    self.assertLessEqual(events[-1]['x']+RADIUS,-1)
                else:
                    self.assertAlmostEqual(events[0]['y']+RADIUS,-1)
                    self.assertGreaterEqual(events[-1]['y']-RADIUS,1)
        self.assertEqual(len(orders),6)

    def test_warnings_every_two_seconds_and_three_second_delay(self):
        game=ExaGame(random.Random(0)); game.start()
        game.update(2.99)
        self.assertEqual(game.state()['circles'],[])
        game.update(.01)
        self.assertEqual(len(game.state()['circles']),2)
        game.update(2)
        self.assertEqual(len(game.state()['circles']),4)
        self.assertFalse(any(c['attack'] for c in game.state()['circles']))
        game.update(1)
        self.assertEqual({c['wave'] for c in game.state()['circles'] if c['attack']},{0})
        self.assertEqual(game.resolved,2)

    def test_late_entry_hits_only_once(self):
        game=ExaGame(random.Random(1)); game.start()
        event=game.events[3]
        game.update(event['at']+.1)
        self.assertEqual(game.hits,[])
        game.x,game.y=event['x'],event['y']+.1
        game.update(.01)
        self.assertEqual(game.hits,[event['id']])
        game.update(.1)
        self.assertEqual(game.hits,[event['id']])

    def test_only_first_circle_has_warning(self):
        game=ExaGame(random.Random(0)); game.start()
        game.update(8)
        circles=game.state()['circles']
        self.assertTrue(any(c['attack'] and c['step'] > 0 for c in circles))
        self.assertTrue(all(c['attack'] or c['step']==0 for c in circles))

    def test_end_pause_and_reset(self):
        game=ExaGame(random.Random(2)); game.start()
        game.paused=True; game.update(30,1,0)
        self.assertEqual(game.time,0)
        game.paused=False; game.update(1,.5,0)
        self.assertAlmostEqual(game.x,.1546875)
        game.update(30,1,1)
        self.assertLessEqual(math.hypot(game.x,game.y),.975+1e-9)
        self.assertEqual(game.resolved,6*2*STEPS)
        self.assertEqual(game.state()['phase'],'result')
        self.assertEqual(game.state()['circles'],[])
        game.reset()
        self.assertEqual(game.state()['patterns'],[])
        self.assertEqual(game.state()['phase'],'ready')
