import math
import random
import unittest

from exa import BLAST_DURATION, COUNTDOWN, LANES, RADIUS, ExaGame


class ExaTests(unittest.TestCase):
    def test_all_six_lane_patterns_and_sequence(self):
        for pattern in range(3):
            game = ExaGame()
            game.start(pattern=str(pattern))
            vertical = [e for e in game.events if e['axis']=='vertical']
            horizontal = [e for e in game.events if e['axis']=='horizontal']
            self.assertEqual({e['x'] for e in vertical},set(LANES[pattern]))
            self.assertEqual({e['y'] for e in horizontal},set(LANES[pattern]))
            self.assertEqual(len(vertical),16)
            self.assertEqual(len(horizontal),16)
            self.assertGreater(min(e['at'] for e in horizontal),max(e['at'] for e in vertical)+BLAST_DURATION)
            self.assertEqual([e['y'] for e in vertical[:8]],sorted(e['y'] for e in vertical[:8]))

    def test_countdown_telegraph_attack_and_no_repeated_hit(self):
        game = ExaGame()
        game.start(pattern='0')
        game.update(COUNTDOWN)
        self.assertEqual(game.state()['phase'],'warning')
        self.assertEqual(len(game.state()['circles']),2)
        game.x,game.y = -.55,-.97
        game.update(1.5)
        self.assertEqual(len(game.hits),1)
        game.update(.1)
        self.assertEqual(len(game.hits),1)
        self.assertEqual(game.resolved,2)
        self.assertTrue(any(c['attack'] for c in game.state()['circles']))

    def test_late_entry_during_blast_is_hit(self):
        game = ExaGame()
        game.start(pattern='0')
        game.update(4.6)
        self.assertEqual(game.hits,[])
        game.x,game.y = -.55,-.9
        game.update(.01)
        self.assertEqual(len(game.hits),1)

    def test_safe_center_and_end_cleanup(self):
        game = ExaGame()
        game.start(pattern='0')
        game.x=game.y=0
        game.update(30)
        self.assertEqual(game.hits,[])
        self.assertEqual(game.resolved,32)
        self.assertFalse(game.running)
        self.assertEqual(game.state()['circles'],[])
        self.assertEqual(game.state()['phase'],'result')

    def test_random_patterns_tempo_pause_and_reset(self):
        patterns=set()
        for seed in range(30):
            game=ExaGame(random.Random(seed))
            game.start(tempo='fast')
            patterns.add(tuple(game.patterns.values()))
            self.assertAlmostEqual(game.events[1]['at']-game.events[0]['at'],.8)
        self.assertEqual(len(patterns),9)
        game.paused=True
        game.update(2,1,0)
        self.assertEqual(game.time,0)
        game.paused=False
        game.update(1,.5,0)
        self.assertAlmostEqual(game.x,.275)
        game.update(10,1,1)
        self.assertLessEqual(math.hypot(game.x,game.y),.975+1e-9)
        game.reset()
        self.assertEqual(game.state()['phase'],'ready')
        self.assertEqual(game.state()['circles'],[])
