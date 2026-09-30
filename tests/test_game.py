import math
import random
import unittest

from game import BAND_WIDTH, BOSS_RADIUS, Game, band_distance, inside_band


class MechanicTests(unittest.TestCase):
    def test_timing_and_order(self):
        game = Game(random.Random(1))
        game.start("cw")
        self.assertEqual(len(game.state()["telegraphs"]), 1)
        for t in range(1, 4):
            game.update(1)
            visible = game.state()["telegraphs"]
            self.assertEqual(len(visible), 1)
            self.assertEqual(visible[0]["index"], t)
        game.update(2.99)
        self.assertEqual(game.resolved, 0)
        game.update(.01)
        self.assertEqual(game.resolved, 1)
        for count in range(2, 5):
            game.update(1)
            self.assertEqual(game.resolved, count)
        game.update(.66)
        self.assertEqual(game.state()["phase"], "result")

    def test_telegraphs_disappear_after_one_second(self):
        game = Game(random.Random(1))
        game.start()
        for i in range(4):
            game.time = i + .999
            self.assertEqual([t["index"] for t in game.state()["telegraphs"]], [i])
            game.time = i + 1
            self.assertNotIn(i, [t["index"] for t in game.state()["telegraphs"]])
        for time in [4, 5, 5.999]:
            game.time = time
            self.assertEqual(game.state()["telegraphs"], [])
            self.assertEqual(game.state()["phase"], "wait")
        for i in range(4):
            game.time = 6 + i
            visible = game.state()["telegraphs"]
            self.assertEqual(len(visible), 1)
            self.assertEqual(visible[0]["index"], i)
            self.assertTrue(visible[0]["attack"])
            game.time = 6 + i + .45
            self.assertEqual(game.state()["telegraphs"], [])

    def test_four_starts_and_rotation(self):
        starts = set()
        for seed in range(100):
            for direction, sign in [("cw", 1), ("ccw", -1)]:
                game = Game(random.Random(seed))
                game.start(direction)
                starts.add(game.angles[0])
                self.assertEqual(len(set(game.angles)), 4)
                for a, b in zip(game.angles, game.angles[1:]):
                    self.assertEqual((b - a) % 360, (sign * 90) % 360)
        self.assertEqual(starts, {45, 135, 225, 315})

    def test_geometry_covers_exact_half_boss(self):
        self.assertLess(BOSS_RADIUS, BAND_WIDTH)
        for angle in [45, 135, 225, 315]:
            covered = 0
            for i in range(360):
                a = math.radians(i + .1)
                d = band_distance(BOSS_RADIUS * math.cos(a), BOSS_RADIUS * math.sin(a), angle)
                covered += 0 <= d <= BAND_WIDTH
            self.assertEqual(covered, 180)
            self.assertTrue(inside_band(0, 0, angle))

    def test_collision_at_attack_and_no_repeat(self):
        game = Game(random.Random(1))
        game.start()
        game.x = game.y = 0
        game.update(9.7)
        self.assertEqual(game.hits, [0, 1, 2, 3])
        game.update(1)
        self.assertEqual(game.hits, [0, 1, 2, 3])

    def test_safe_point_for_each_attack(self):
        game = Game(random.Random(1))
        game.start()
        for index, angle in enumerate(game.angles):
            a = math.radians(angle)
            game.x, game.y = -.7 * math.cos(a), -.7 * math.sin(a)
            game.update(6 if index == 0 else 1)
        self.assertEqual(game.hits, [])

    def test_movement_normalization_boundary_and_pause(self):
        a, b = Game(), Game()
        a.update(.1, 1, 0)
        b.update(.1, 1, 1)
        self.assertAlmostEqual(math.hypot(a.x, a.y - .72), math.hypot(b.x, b.y - .72))
        a.update(10, 1, 1)
        self.assertLessEqual(math.hypot(a.x, a.y), .975 + 1e-9)
        a.start()
        a.paused = True
        a.update(10, 1, 0)
        self.assertEqual(a.time, 0)
        self.assertEqual(a.x, 0)
        a.reset()
        self.assertEqual(a.state()["phase"], "ready")

    def test_analog_speed_and_stick_release(self):
        slow, full = Game(), Game()
        slow.update(.1, .5, 0)
        full.update(.1, 1, 0)
        self.assertAlmostEqual(slow.x, full.x / 2)
        # Releasing the stick stops movement immediately.
        slow.update(.1, .5, 0)
        position = (slow.x, slow.y)
        slow.update(.5, 0, 0)
        self.assertEqual((slow.x, slow.y), position)


if __name__ == "__main__":
    unittest.main()
