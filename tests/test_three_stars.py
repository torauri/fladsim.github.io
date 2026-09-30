import unittest
import math
import random

from three_stars import ELEMENTS, PHASE_CHECKS, PHASE_STARTS, TOWER_DISTANCE, ThreeStarsGame, due_checks, timeline_at


class ThreeStarsTimelineTests(unittest.TestCase):
    def test_countdown_and_debuff_preparation(self):
        for time, count in [(0, 3), (.999, 3), (1, 2), (2, 1), (2.999, 1)]:
            self.assertEqual(timeline_at(time)["countdown"], count)
        self.assertEqual(timeline_at(3)["phase"], "preparation")
        self.assertEqual(timeline_at(5.999)["wave"], 0)

    def test_three_seven_second_waves(self):
        self.assertEqual(PHASE_STARTS, (6, 13, 20))
        self.assertEqual(PHASE_CHECKS, (13, 20, 27))
        for index, start in enumerate(PHASE_STARTS):
            state = timeline_at(start)
            self.assertEqual(state["wave"], index + 1)
            self.assertEqual(state["remaining"], 7)
            self.assertEqual(timeline_at(start + 6.999)["wave"], index + 1)
        self.assertEqual(timeline_at(27)["phase"], "result")

    def test_judgments_are_not_skipped_or_repeated(self):
        self.assertEqual(due_checks(0, 12.999), [])
        self.assertEqual(due_checks(12.999, 13), [0])
        self.assertEqual(due_checks(13, 20), [1])
        self.assertEqual(due_checks(20, 27), [2])
        self.assertEqual(due_checks(0, 28), [0, 1, 2])
        self.assertEqual(due_checks(27, 28), [])


class ThreeStarsMechanicTests(unittest.TestCase):
    def test_judgment_cylinders_use_previous_wave_and_fade_after_final_check(self):
        game = ThreeStarsGame(random.Random(4))
        game.start()
        game.update(12.99)
        self.assertFalse(any(t['judgment'] for t in game.state()['towers']))
        for wave in range(3):
            game.update(.01 if wave == 0 else 6.2)
            state = game.state()
            self.assertEqual({t['id'] for t in state['towers'] if t['judgment']}, set(game.patterns[wave]))
            game.paused = True
            game.update(1)
            self.assertEqual(game.state()['judgment_progress'],state['judgment_progress'])
            game.paused = False
            game.update(.8)
            self.assertFalse(any(t['judgment'] for t in game.state()['towers']))
        self.assertAlmostEqual(game.time,27)
        game.reset()
        self.assertFalse(any(t['judgment'] for t in game.state()['towers']))

    def test_fixed_north_gap_with_random_attribute_groups(self):
        orders = set()
        for seed in range(40):
            game = ThreeStarsGame(random.Random(seed))
            game.start()
            orders.add(tuple(t['element'] for t in game.towers[::3]))
            for i, tower in enumerate(game.towers):
                angle = math.radians(-70 + i * 40)
                self.assertAlmostEqual(tower['x'], math.cos(angle) * .54)
                self.assertAlmostEqual(tower['y'], math.sin(angle) * .54)
            self.assertAlmostEqual(game.state()['boss_attack_radius'], .54)
        self.assertEqual(len(orders), 6)

    def test_nine_towers_four_lit_and_unique_extras(self):
        for seed in range(40):
            game = ThreeStarsGame(random.Random(seed))
            game.start()
            self.assertEqual(len(game.towers), 9)
            self.assertEqual(set(game.extra_elements), set(ELEMENTS))
            for element in ELEMENTS:
                self.assertEqual(sum(t['element'] == element for t in game.towers), 3)
            for wave, active in enumerate(game.patterns):
                self.assertEqual(len(set(active)), 4)
                for element in ELEMENTS:
                    self.assertEqual(sum(game.towers[i]['element'] == element for i in active), 2 if game.extra_elements[wave] == element else 1)

    def test_clockwise_assignment_and_none_take_four_distinct_towers(self):
        for seed in range(40):
            game = ThreeStarsGame(random.Random(seed))
            game.start()
            for wave in range(3):
                targets = [game.target_for(wave, debuff) for debuff in [None, *ELEMENTS]]
                self.assertEqual(set(targets), set(game.patterns[wave]))
                pair = [i for i in game.patterns[wave] if game.towers[i]['element'] == game.extra_elements[wave]]
                self.assertEqual(game.target_for(wave, None), max(pair))

    def test_debuff_timing_and_phase_transition(self):
        game = ThreeStarsGame(random.Random(1))
        game.start('fire','earth')
        game.update(2.999)
        self.assertFalse(game.state()['debuff_assigned'])
        game.update(.001)
        self.assertEqual(game.debuff,'fire')
        self.assertTrue(game.state()['debuff_assigned'])
        game.update(3)
        self.assertEqual(game.state()['wave'],1)
        self.assertEqual(sum(t['active'] for t in game.state()['towers']),4)
        game.update(7)
        self.assertEqual(game.resolved,1)
        self.assertEqual(game.state()['wave'],2)
        self.assertIsNone(game.state()['boss_effect'])
        game.update(7)
        self.assertEqual(game.resolved,2)
        self.assertEqual(game.state()['wave'],3)
        game.update(7)
        self.assertFalse(game.running)
        self.assertEqual(game.state()['phase'],'result')
        game.update(2)
        self.assertEqual(game.resolved,3)

    def test_correct_paths_succeed_for_all_debuffs_and_attacks(self):
        for seed in range(12):
            for debuff in ['none', *ELEMENTS]:
                for attack in ['earth','wind']:
                    game = ThreeStarsGame(random.Random(seed))
                    game.start(debuff,attack)
                    game.update(6)
                    for wave in range(3):
                        tower = game.towers[game.expected_tower]
                        radius = TOWER_DISTANCE + (.06 if attack == 'earth' else -.06)
                        game.x,game.y = tower['x'] * radius / TOWER_DISTANCE,tower['y'] * radius / TOWER_DISTANCE
                        game.update(7)
                    self.assertEqual(game.hits,[], (seed,debuff,attack,game.results))
                    self.assertEqual(len(game.results),3)

    def test_tower_and_boss_failures_are_independent(self):
        for attack in ['earth','wind']:
            game = ThreeStarsGame(random.Random(3))
            game.start('none',attack)
            game.update(6)
            tower = game.towers[game.expected_tower]
            game.x,game.y = tower['x'],tower['y']
            game.update(7)
            self.assertEqual(game.results[0]['reasons'],[attack])
        game = ThreeStarsGame(random.Random(3))
        game.start('fire','wind')
        game.x, game.y = 0, 0
        game.update(13)
        self.assertEqual(game.results[0]['reasons'],['no_tower'])

    def test_pause_reset_and_analog_movement(self):
        game = ThreeStarsGame(random.Random(2))
        game.start()
        game.update(1,.5,0)
        self.assertAlmostEqual(game.x,.275)
        game.paused = True
        game.update(30,1,0)
        self.assertAlmostEqual(game.time,1)
        game.reset()
        self.assertEqual(game.state()['phase'],'ready')
        self.assertEqual(game.results,[])
