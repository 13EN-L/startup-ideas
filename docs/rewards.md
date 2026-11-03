# FocusGarden Reward Rules

How a completed task's productive time grows plants. This is the source of truth for
reward behavior: code in `src/main/rewards/` must match it, and any rule change
updates this file in the same commit.

## Categories and plants

Each task has one of 10 categories. Each category has its own plant and plot.

| Category           | Covers                                   | Plant        |
| ------------------ | ---------------------------------------- | ------------ |
| Work               | job tasks, projects, meetings            | Pine         |
| School / Study     | classes, homework, exam prep             | Tomato       |
| Health & Fitness   | exercise, nutrition, sleep, appointments | Apple        |
| Finance            | budgeting, bills, saving, investing      | Lilac        |
| Home               | chores, cleaning, repairs, errands       | Corn         |
| Relationships      | family, friends, social plans            | Sunflower    |
| Personal Growth    | reading, new skills, courses             | Succulent    |
| Creative           | writing, art, music, hobbies             | Basil        |
| Career Development | networking, resume, side projects        | Carrot       |
| Self-Care          | rest, mindfulness, fun and leisure       | Monkey grass |

A plant and its plot don't exist until the first task in that category is completed.
From then on, the plant starts at stage 1, even if that task had no productive time.

## Time buckets

When a task is stopped, its time splits into three buckets:

| Bucket       | Meaning                              | Grows plants? |
| ------------ | ------------------------------------ | ------------- |
| Productive   | On-task (per Claude), not idle       | Yes           |
| Unproductive | Off-task (per Claude), not idle      | No            |
| Idle         | AFK, per ActivityWatch's AFK watcher | No            |

Overlapping ActivityWatch events covering the same span are counted once.

**Overlapping tasks.** Up to 3 tasks can run at once, so the same span of time can
fall inside more than one task. A task's productive time always goes to the plant
for the category the user picked in that task's dropdown.

- **Different categories:** each task's productive time goes to its own plant. The
  overlapping span can grow more than one plant.
- **Same category:** overlapping time doesn't stack. Each second grows that
  category's plant at most once, however many of its tasks it falls inside.

## When growth happens

Plants grow only when a task is completed. That task's productive time is added to
its category's plant as one sum. Plants never grow in real time, including while the
user is on the garden page.

If classification fails, the task waits for results and is retried. It adds nothing
until it's labeled. Labels are final, so progress only goes up.

**Retry cap.** Classification is retried up to 5 times per app session (after 30 s, 1, 2,
5, and 10 min). If all 5 retries fail, every item in the task is labeled **off-task**:
the task completes with 0 productive time, adds no growth, and still creates its
category's plant if it's the first task there. This applies only when Claude can't
produce labels (network errors, overload, invalid output, refusals). A missing or
rejected API key never triggers it; the task waits until a key is saved. Items are
never defaulted to on-task.

## The growth cycle

A plant has 6 stages. Each stage takes 6 minutes of productive time, so one full
cycle takes 36 minutes.

| Stage | Productive minutes in cycle |
| ----- | --------------------------- |
| 1     | 0 to 6                      |
| 2     | 6 to 12                     |
| 3     | 12 to 18                    |
| 4     | 18 to 24                    |
| 5     | 24 to 30                    |
| 6     | 30 to 36                    |

Within a stage, the stage image scales up linearly with progress through that stage:
100% size at the start, up to 110% just before the next stage. At each 6-minute mark
the image switches to the next stage and returns to 100%. Keep the 10% in one
constant, `MAX_STAGE_SCALE_UP = 0.10`.

Scale = 1 + `MAX_STAGE_SCALE_UP` × progress within stage.

## Prestige (wrap-around)

When a plant reaches 36 minutes and still has productive time left over, it wraps
around: it starts again at stage 1 with the leftover time added, and the plant's
prestige goes up by 1. A plant's prestige is the number of full cycles it has finished.

## Formulas

Everything is derived from one stored number per plant: its total productive
**seconds**. Partial minutes count (30 s + 30 s = 1 min).

- Cycle length = `MINUTES_PER_PLANT` × 60 = 2160 s
- Stage length = `MINUTES_PER_STAGE` × 60 = 360 s
- Prestige = floor(total / 2160)
- Time in current cycle = total mod 2160
- Stage = floor(time in cycle / 360) + 1 (1 to 6)
- Progress within stage = (time in cycle mod 360) / 360 (drives the scale-up)

Deriving these from the total keeps the numbers from drifting apart. Derive 2160 and
360 from the constants; don't hardcode them.

## Global prestige and trophies

Global prestige = the sum of every plant's prestige. Trophies appear under the
FocusGarden logo on the garden page and stay once earned:

| Global prestige | Trophy                  |
| --------------- | ----------------------- |
| 1 or more       | Bronze                  |
| 10 or more      | Silver (next to bronze) |
| 100 or more     | Gold (next to silver)   |

## Worked examples

**From the spec (no wrap).** Plant at 0 min. A task adds 20 productive min.
20 = 3 full stages (18 min) + 2 → **stage 4, scaled for 2 min** (2/6 of 10% ≈ 103.3%).

**From the spec (wrap).** Plant at 35 min of its cycle, prestige 1. A task adds 10 min.
35 + 10 = 45 → one wrap (36) with 9 left → **stage 2, scaled for 3 min (105%), prestige 2**.

**First task in a category.** Task completed with 0 productive min (all idle).
The plant and plot now exist → **stage 1, no scale-up**.

**Idle and off-task time.** 40-min task: 25 on-task, 5 off-task, 10 idle.
Only **25 min** is added.

**Partial minutes.** Plant at 5 min 40 s. A task adds 20 s → **stage 2, start**.

**Overlap, different categories.** A Work task and a Study task both run 2:00–2:30,
and Claude labels that 30 min on-task for both → **Pine +30 min, Tomato +30 min**.

**Overlap, same category.** Two Work tasks both run 2:00–2:30, both on-task →
**Pine +30 min**, not 60.

**Retries exhausted.** A first Creative task: 20 min on-task, 5 off-task, 5 idle, but
classification fails 6 times (the first try plus 5 retries) → all items off-task →
**Basil appears at stage 1 with +0 min**. The task shows 25 min off-task, 5 min idle.

**Trophy.** Three plants at prestige 4, 3, 2 → global 9, bronze only. The next wrap
makes it 10 → **silver appears**.
