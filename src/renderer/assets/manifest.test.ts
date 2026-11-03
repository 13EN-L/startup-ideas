import { describe, expect, it } from 'vitest'
import { ANIMALS, PLANT_FOR_CATEGORY } from '../../shared/domain'
import { animalImage, plantImage, trophyImage, ui } from './manifest'

describe('asset manifest', () => {
  it('has all 6 stages for every plant', () => {
    for (const plant of Object.values(PLANT_FOR_CATEGORY)) {
      for (let stage = 1; stage <= 6; stage++) {
        expect(plantImage(plant, stage), `${plant} stage ${stage}`).toMatch(/\.png/)
      }
    }
  })

  it('maps multi-word plant names to their files', () => {
    expect(plantImage('Monkey grass', 3)).toContain('monkeygrass-stage3.png')
  })

  it('rejects a stage outside 1 to 6', () => {
    expect(() => plantImage('Pine', 0)).toThrow('No image for Pine stage 0')
    expect(() => plantImage('Pine', 7)).toThrow('No image for Pine stage 7')
  })

  it('has every animal', () => {
    for (const animal of ANIMALS) expect(animalImage(animal), animal).toMatch(/\.png/)
  })

  it('has every trophy and UI image', () => {
    for (const trophy of ['bronze', 'silver', 'gold'] as const) {
      expect(trophyImage(trophy)).toContain(`trophy-${trophy}.png`)
    }
    expect(ui.cloud).toContain('cloud.png')
    expect(ui.fence).toContain('fence.png')
    expect(ui.gate).toContain('gate.png')
    expect(ui.logo).toContain('logo.png')
    expect(ui.spinner).toContain('spinner.png')
    expect(ui.homeSign.active).toContain('home-sign-active.png')
    expect(ui.homeSign.inactive).toContain('home-sign-inactive.png')
  })
})
