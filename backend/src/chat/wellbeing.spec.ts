import { DANGER_PHRASES, SAD_PHRASES } from '../content/wellbeing-phrases';
import { detectDistress } from './wellbeing';

describe('detectDistress (AIB-03)', () => {
  it('hears a player who feels down as sad (AC1)', () => {
    expect(detectDistress('I feel really down today')).toBe('sad');
    expect(detectDistress("I'm so stressed about everything")).toBe('sad');
    expect(detectDistress('im upset')).toBe('sad');
    expect(detectDistress('Nobody likes me at school.')).toBe('sad');
  });

  it('hears a danger phrase as danger (AC2)', () => {
    expect(detectDistress('sometimes I want to hurt myself')).toBe('danger');
    expect(detectDistress('I dont want to be here anymore')).toBe('danger');
  });

  it('lets danger win over sad', () => {
    expect(detectDistress("I'm sad and I want to end it all")).toBe('danger');
  });

  it('ignores sad words about a plant or a creature', () => {
    expect(detectDistress('the sunflower looks sad')).toBe('none');
    expect(detectDistress('my clover is feeling down')).toBe('none');
    expect(detectDistress("The snail's really lonely")).toBe('none');
    expect(detectDistress('what a lonely little mushroom')).toBe('none');
  });

  it('still hears the player next to a sad plant', () => {
    expect(detectDistress('my clover looks sad and I feel really down')).toBe(
      'sad',
    );
  });

  it('leaves ordinary chat alone', () => {
    for (const text of [
      'Hello! Do you like the new pond?',
      'I planted three sunflowers for you',
      'What is your favourite cloud?',
      'Sadly the frog ate my sandwich, haha',
      'Calm down, little bee!',
      '',
    ]) {
      expect([text, detectDistress(text)]).toEqual([text, 'none']);
    }
  });

  it('matches whole words only, ignoring case, accents and punctuation', () => {
    expect(detectDistress('Saddle up, snail!')).toBe('none');
    expect(detectDistress('SAD!!!')).toBe('sad');
    expect(detectDistress('I’m feeling dówn')).toBe('sad');
    expect(detectDistress('killmyself')).toBe('danger');
  });

  it('detects every listed phrase as its own category', () => {
    for (const phrase of SAD_PHRASES) {
      expect([phrase, detectDistress(`Honestly, ${phrase}.`)]).toEqual([
        phrase,
        'sad',
      ]);
    }
    for (const phrase of DANGER_PHRASES) {
      expect([phrase, detectDistress(`Honestly, ${phrase}.`)]).toEqual([
        phrase,
        'danger',
      ]);
    }
  });
});
