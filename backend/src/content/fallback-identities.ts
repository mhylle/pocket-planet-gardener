import type { CreatureIdentity } from '../creatures/identity.types';
import type { SpeciesId } from './content.types';

/**
 * Pre-written identities for when the AI cannot make one (AIB-05): at least
 * ten per species, each fitting its species (AIB-07 AC2), with names unique
 * across the whole pool. They follow the same rules as AI identities (SD
 * section 10), which the content spec checks.
 */
export const FALLBACK_IDENTITIES: Readonly<
  Record<SpeciesId, readonly CreatureIdentity[]>
> = {
  worm: [
    {
      name: 'Wigglesworth',
      traits: ['earnest', 'curious'],
      quirk:
        'He suspects the whole planet is a very large potato and is gathering evidence.',
      speakingStyle: 'slow and thoughtful, full of soil facts',
      backstory:
        'Wigglesworth tunnelled up through the soil the moment the first flower opened. He has tasted three patches of ground so far, and all of them were a bit potato-ish. The investigation continues.',
      summary: 'A thoughtful worm who suspects the planet is a potato.',
    },
    {
      name: 'Squiggle',
      traits: ['bouncy', 'cheerful'],
      quirk:
        'She ties herself in a loose bow whenever she is happy, which is most of the time.',
      speakingStyle: 'quick and giggly, with lots of exclamation marks',
      backstory:
        'Squiggle arrived wriggling with joy and has hardly stopped since. She is getting rather skilled at untying herself before lunch.',
      summary: 'A giggly worm who ties herself in happy bows.',
    },
    {
      name: 'Professor Loam',
      traits: ['scholarly', 'gentle'],
      quirk:
        'He gives tiny lectures about soil to anyone who stands still long enough.',
      speakingStyle: 'polite and precise, like a slightly dusty teacher',
      backstory:
        'Professor Loam has studied soil all his life, mostly by eating it. He is writing a book about why dirt is wonderful. So far it is one very long chapter.',
      summary: 'A scholarly worm who lectures everyone about lovely soil.',
    },
    {
      name: 'Swirl',
      traits: ['dreamy', 'artistic'],
      quirk:
        'She digs her tunnels in spirals and calls each one a masterpiece.',
      speakingStyle: 'soft and wandering, often trailing off mid-thought',
      backstory:
        'Swirl believes every tunnel should be a work of art. She has made a whole gallery under the first flower, though nobody can see it. That suits her perfectly.',
      summary: 'A dreamy worm who digs secret spiral art underground.',
    },
    {
      name: 'Duncan',
      traits: ['brave', 'grand'],
      quirk:
        'He insists he is a mighty sea serpent who simply took a wrong turn.',
      speakingStyle: 'booming and heroic, then suddenly shy',
      backstory:
        'Duncan says he crossed seven oceans before landing in this flowerbed. Nobody has the heart to mention that he came from the compost. He is very proud of his voyage.',
      summary: 'A small worm convinced he is a mighty sea serpent.',
    },
    {
      name: 'Dottie',
      traits: ['tidy', 'brisk'],
      quirk:
        'She sweeps her tunnel every morning with a single blade of grass.',
      speakingStyle: 'brisk and proper, with a tiny sniff before each sentence',
      backstory:
        'Dottie arrived with a blade of grass already tucked under her chin. She keeps the neatest tunnel on the planet and gives tours on request. Wipe your feet, please.',
      summary: 'A very tidy worm with the neatest tunnel on the planet.',
    },
    {
      name: 'Rumble',
      traits: ['sleepy', 'warm-hearted'],
      quirk: 'He snores so loudly underground that the flowers above him sway.',
      speakingStyle: 'mumbly and yawning, but very kind',
      backstory:
        'Rumble came up to admire the first bloom and decided to nap beside it. He has been napping there ever since, with short breaks for more napping.',
      summary: 'A sleepy worm whose snores make the flowers sway.',
    },
    {
      name: 'Natter',
      traits: ['chatty', 'nosy'],
      quirk:
        'She pops her head up through the soil to join every conversation, invited or not.',
      speakingStyle: 'fast and breathless, always in the middle of some news',
      backstory:
        'Natter heard there was a new flower and tunnelled over at top speed. She now knows everything that happens above and below ground. She shares it all, very generously.',
      summary: 'A chatty worm who pops up for every bit of news.',
    },
    {
      name: 'Humbleby',
      traits: ['polite', 'gentle'],
      quirk: 'He says sorry to every pebble he bumps into, just in case.',
      speakingStyle: 'very polite, with plenty of please and thank you',
      backstory:
        'Humbleby is the most courteous worm anyone has met. He once apologised to a puddle for a whole afternoon. The puddle took it very well.',
      summary: 'An extremely polite worm who apologises to pebbles.',
    },
    {
      name: 'Juniper',
      traits: ['adventurous', 'optimistic'],
      quirk:
        'She is digging a tunnel to the far side of the planet and reports her progress daily.',
      speakingStyle: 'cheery and determined, like an explorer on the radio',
      backstory:
        'Juniper is sure that something marvellous waits on the far side of the planet. She has dug almost a whole worm-length so far. The expedition continues.',
      summary: 'An explorer worm tunnelling to the far side of the planet.',
    },
  ],
  snail: [
    {
      name: 'Bartholomew',
      traits: ['dramatic', 'proud', 'kind-hearted'],
      quirk:
        'He believes he is a world-famous opera singer and warms up at the pond every morning.',
      speakingStyle: 'grand and theatrical, with long dramatic pauses',
      backstory:
        'Bartholomew is certain that crowds once threw roses at his feet. He sings to the clover each dawn and then takes a slow, slow bow. The bow takes most of the morning.',
      summary: 'A slow snail who believes he is a famous opera star.',
    },
    {
      name: 'Clementine',
      traits: ['welcoming', 'patient'],
      quirk:
        'She redecorates the inside of her shell every week and shows guests around.',
      speakingStyle: 'warm and welcoming, like a cosy host',
      backstory:
        'Clementine carries her home everywhere and keeps it spotless. She has tried a moss carpet, a pebble floor and a petal ceiling. Guests are always welcome, one very small guest at a time.',
      summary: 'A homely snail who redecorates her shell every single week.',
    },
    {
      name: 'Ponderosa',
      traits: ['wise', 'unhurried'],
      quirk:
        'She thinks so carefully before answering that a question can take her all day.',
      speakingStyle: 'slow and wise, with very long pauses',
      backstory:
        'Ponderosa likes to think things through properly. She has been thinking about the pond since she arrived and is nearly ready to share her opinion. It will be worth the wait.',
      summary: 'A very wise snail who thinks very, very slowly.',
    },
    {
      name: 'Speedwell',
      traits: ['competitive', 'cheerful'],
      quirk:
        'He is sure he is the fastest racer on the planet and challenges falling leaves to races.',
      speakingStyle:
        'like an excited sports commentator describing his own every move',
      backstory:
        'Speedwell has won every race on the planet, mostly because he organises them himself. He once beat a pebble by a whole afternoon. He still talks about it.',
      summary: 'A snail who races falling leaves and is sure he wins.',
    },
    {
      name: 'Mabel',
      traits: ['artistic', 'generous'],
      quirk:
        'She paints shimmering pictures with her slime trail and leaves them as gifts.',
      speakingStyle: 'chirpy and encouraging, like a kindly art teacher',
      backstory:
        'Mabel thinks a slime trail should be beautiful as well as useful. Each morning a new silvery swirl appears beside the clover. She signs every one with a tiny loop.',
      summary: 'An artistic snail who paints silver pictures with her trail.',
    },
    {
      name: 'Gideon',
      traits: ['careful', 'orderly'],
      quirk: 'He collects dewdrops in the morning and lines them up by size.',
      speakingStyle: 'precise and proud, like a collector showing off',
      backstory:
        'Gideon rises early to gather the freshest dewdrops on the planet. He arranges them in neat rows on a leaf, smallest to biggest. By noon they have all gone, so he starts again the next day.',
      summary: 'A careful snail who collects dewdrops and lines them up.',
    },
    {
      name: 'Posy',
      traits: ['sunny', 'sociable'],
      quirk:
        'She has said hello to every clover, pebble and drop of dew on the planet.',
      speakingStyle: 'bubbly and friendly, waving her eye stalks as she talks',
      backstory:
        'Posy believes nobody should go a single day without a hello. Having greeted everything on the planet once, she has started on round two. Nobody minds one bit.',
      summary: 'A friendly snail determined to greet everything on the planet.',
    },
    {
      name: 'Barnaby',
      traits: ['dapper', 'jolly'],
      quirk:
        'He polishes his shell to a shine and wears a dewdrop like a monocle.',
      speakingStyle: 'posh and old-fashioned, full of splendid and what ho',
      backstory:
        'Barnaby arrived looking very smart, as if he were off to a garden party. He believes every day might turn into a garden party. So far he has not been wrong.',
      summary: 'A dapper snail with a shiny shell and a dewdrop monocle.',
    },
    {
      name: 'Puddlewick',
      traits: ['splashy', 'daring'],
      quirk:
        'She is sure the pond is a mighty ocean and calls herself its bravest sailor.',
      speakingStyle: 'salty sailor talk, with plenty of ahoy',
      backstory:
        'Puddlewick has crossed the great pond on a floating leaf many times. She claims to have discovered three islands, all of which are pebbles. She has named each one after herself.',
      summary: 'A seafaring snail who thinks the pond is the ocean.',
    },
    {
      name: 'Twinkle',
      traits: ['dreamy', 'calm'],
      quirk:
        'She names one star every night and keeps careful track of them all.',
      speakingStyle: 'hushed and dreamy, like a bedtime story',
      backstory:
        'Twinkle starts climbing the tallest clover each afternoon so she reaches the top by nightfall. From there she names the stars, one per night. She called the brightest one Twinkle, just to be safe.',
      summary: 'A dreamy snail who names one star every single night.',
    },
  ],
  bee: [
    {
      name: 'Bumbleton',
      traits: ['punctual', 'organised'],
      quirk:
        'He keeps a timetable for every flower on the planet and is never late for a bloom.',
      speakingStyle: 'brisk and efficient, like a station announcer',
      backstory:
        'Bumbleton arrived the moment three kinds of flower opened at once. He drew up a visiting timetable on his first day and sticks to it to the second. The flowers have started opening on time just to please him.',
      summary: 'A very punctual bee with a timetable for every flower.',
    },
    {
      name: 'Hattie',
      traits: ['joyful', 'lively'],
      quirk:
        'She explains everything with a little waggle dance, even the weather.',
      speakingStyle: 'sing-song and bouncy, with lots of happy buzzing',
      backstory:
        'Hattie believes any news is better told with a dance. She once danced for an hour to say it was cloudy. Everyone agreed it was a lovely dance.',
      summary: 'A joyful bee who explains everything with a waggle dance.',
    },
    {
      name: 'Sir Buzzalot',
      traits: ['gallant', 'loyal'],
      quirk:
        'He believes he is a knight and bows deeply to every flower he visits.',
      speakingStyle: 'noble and formal, with lots of noble sir and fair flower',
      backstory:
        'Sir Buzzalot appointed himself protector of the flowerbeds on his very first day. He patrols them in careful loops and reports that all is well. The flowers have never felt safer.',
      summary: 'A gallant bee who thinks he is a knight of the flowers.',
    },
    {
      name: 'Saffron',
      traits: ['stylish', 'confident'],
      quirk:
        'She wears pollen like a fancy coat and admires herself in every dewdrop.',
      speakingStyle: 'smooth and showy, like a fashion show host',
      backstory:
        'Saffron believes no bee has ever looked as fine as she does after a busy morning. She tries a new shade of pollen every day. Today it is sunflower yellow, as usual.',
      summary: 'A stylish bee who wears pollen like a fancy coat.',
    },
    {
      name: 'Mimsy',
      traits: ['shy', 'sweet'],
      quirk:
        'She hums quietly to each flower before landing, to ask if it is all right.',
      speakingStyle: 'soft and gentle, barely more than a whisper',
      backstory:
        'Mimsy is the politest bee in the garden. She always asks before she sips. The flowers think she is lovely.',
      summary: 'A shy bee who politely asks each flower before visiting.',
    },
    {
      name: 'Captain Fuzz',
      traits: ['bold', 'cheerful'],
      quirk:
        'He flies in loops and announces his own flight path like a pilot.',
      speakingStyle: 'crackly pilot announcements, with lots of roger that',
      backstory:
        'Captain Fuzz has made over a thousand landings on this planet, by his own count. He gives each one a score. Almost all of them are perfect, he says.',
      summary: 'A bee pilot who announces every loop and landing.',
    },
    {
      name: 'Nectarina',
      traits: ['curious', 'discerning'],
      quirk: 'She tastes every flower and gives it a very serious review.',
      speakingStyle: 'like a thoughtful food critic, savouring every word',
      backstory:
        'Nectarina considers herself the leading nectar expert on the planet. She describes each sip with words like zesty and sunny. The tulips are hoping for a glowing review.',
      summary: 'A bee food critic who reviews every flower on the planet.',
    },
    {
      name: 'Bramble',
      traits: ['sentimental', 'chatty'],
      quirk:
        'He keeps a tiny souvenir from every flower he visits, such as a crumb of petal.',
      speakingStyle: 'proud and chatty, like a tour guide',
      backstory:
        'Bramble has a little collection of keepsakes from every flower he has met. He sorts them by colour and then by smell. He would love to show you.',
      summary: 'A collector bee who keeps a souvenir from every flower.',
    },
    {
      name: 'Zinnia',
      traits: ['musical', 'upbeat'],
      quirk:
        'She is sure her buzzing is a song and is writing her first album.',
      speakingStyle: 'rhythmic and catchy, like song lyrics',
      backstory:
        'Zinnia buzzes along with the wind and calls it her greatest hit. She has written a song about every flower on the planet. The clover song is her favourite.',
      summary: 'A musical bee writing a song for every single flower.',
    },
    {
      name: 'Tumble',
      traits: ['dozy', 'cheerful'],
      quirk:
        'He falls asleep inside flowers and wakes up covered from head to toe in pollen.',
      speakingStyle: 'sleepy and giggly, with happy yawns',
      backstory:
        'Tumble meant to visit just one flower on his first day. He woke up inside a sunflower the next morning, completely yellow. He now plans his naps around the best blooms.',
      summary: 'A dozy bee who naps inside flowers and wakes up yellow.',
    },
  ],
  moth: [
    {
      name: 'Lumen',
      traits: ['opinionated', 'passionate'],
      quirk:
        'She has very strong opinions about lamp-posts and rates each one for glow and style.',
      speakingStyle: 'firm and fussy, like a judge at a lamp show',
      backstory:
        'Lumen has visited a great many lamps and found most of them a little too dim. The lamp-post here is the first to earn top marks. She stares at it for hours and calls it research.',
      summary: 'A moth with very strong opinions about lamp-posts.',
    },
    {
      name: 'Smudge',
      traits: ['gentle', 'scatterbrained'],
      quirk:
        'He leaves a little puff of wing dust wherever he lands and calls it his autograph.',
      speakingStyle: 'soft and drifting, with sleepy pauses',
      backstory:
        'Smudge flutters about so softly that most creatures only notice the dust. He thinks of each puff as a signed picture. The bench is covered in them.',
      summary: 'A soft moth who signs everything with a puff of dust.',
    },
    {
      name: 'Moonbeam',
      traits: ['dreamy', 'poetic'],
      quirk:
        'She writes little poems to the moonflowers and reads them aloud at midnight.',
      speakingStyle: 'poetic and dreamy, every line a little verse',
      backstory:
        'Moonbeam fluttered in when the moonflowers opened and has not stopped rhyming since. Her favourite word is glow, because so much rhymes with it. Snow, slow and toe all feature heavily.',
      summary: 'A poetic moth who writes verses to the moonflowers.',
    },
    {
      name: 'Whisk',
      traits: ['quick', 'excitable'],
      quirk:
        'He is certain the moon is just a very large lamp and plans to visit it.',
      speakingStyle: 'breathless and excited, with lots of wow',
      backstory:
        'Whisk has tried flying to the moon several times and always ends up back at the lamp-post. He counts each try as useful practice. One day, he says, one day.',
      summary: 'A moth determined to fly to the moon, eventually.',
    },
    {
      name: 'Velvet',
      traits: ['elegant', 'calm'],
      quirk: 'She only rests on things that match the soft grey of her wings.',
      speakingStyle: 'smooth and graceful, like a quiet museum guide',
      backstory:
        'Velvet has the softest wings on the planet and likes to keep them that way. She spends her evenings choosing the perfect resting spot. The grey rock is her current favourite.',
      summary: 'An elegant moth who only rests on things that match.',
    },
    {
      name: 'Doctor Fluff',
      traits: ['clever', 'absent-minded'],
      quirk:
        'He studies light by flying very close to it, carefully and often.',
      speakingStyle: 'learned and rambling, full of hmm and fascinating',
      backstory:
        'Doctor Fluff has spent years finding out why lamps are so wonderful. His method is mostly fluttering around them in circles. He is very close to a breakthrough.',
      summary: 'A scientist moth researching lamps by circling them for hours.',
    },
    {
      name: 'Sparkwing',
      traits: ['hopeful', 'determined'],
      quirk:
        'She practises glowing like a firefly every night and is sure it will work soon.',
      speakingStyle: 'bright and encouraging, cheering herself on',
      backstory:
        'Sparkwing admires fireflies more than anything. She practises glowing every night, scrunching up her face very hard. So far she has produced one small sneeze.',
      summary: 'A hopeful moth practising very hard to glow like a firefly.',
    },
    {
      name: 'Murmur',
      traits: ['quiet', 'thoughtful'],
      quirk:
        'He only speaks in a whisper so he never wakes the sleeping flowers.',
      speakingStyle: 'whispery and calm, never above a murmur',
      backstory:
        'Murmur loves the planet best when everyone else is asleep. He tiptoes about the sky, which is tricky while flying. He says the night is for listening.',
      summary: 'A whispery moth who loves the quiet of the night.',
    },
    {
      name: 'Biscuit',
      traits: ['cosy', 'contented'],
      quirk:
        'He believes the lamp-post was put there to keep him warm and thanks it every evening.',
      speakingStyle: 'warm and contented, like a purring cat',
      backstory:
        'Biscuit is a round, fuzzy moth who loves anything warm. He snuggles up close to the lamp-post each night. He has written it a thank-you note.',
      summary: 'A fuzzy moth who thinks the lamp-post is his own heater.',
    },
    {
      name: 'Pirouette',
      traits: ['graceful', 'shy'],
      quirk:
        'She dances ballet in the lamplight, but only when she thinks nobody is looking.',
      speakingStyle: 'shy and delicate, with little gasps',
      backstory:
        'Pirouette dances every night in the circle of light under the lamp-post. When anyone looks, she pretends to be resting. Everyone has seen her, and everyone thinks she is wonderful.',
      summary: 'A shy moth who dances ballet in the lamplight.',
    },
  ],
  hedgehog: [
    {
      name: 'Bristle',
      traits: ['proud', 'fastidious'],
      quirk:
        'He combs his spines every morning and insists they are a hairstyle.',
      speakingStyle: 'fussy and fashionable, like a busy hairdresser',
      backstory:
        'Bristle arrived with every spine pointing in exactly the same direction. He spends his mornings keeping it that way. He would happily give you tips.',
      summary: 'A stylish hedgehog who thinks his spines are a hairstyle.',
    },
    {
      name: 'Truffle',
      traits: ['curious', 'snuffly'],
      quirk:
        'She can smell a mushroom from the far side of the planet and announces each one.',
      speakingStyle: 'excited and snuffly, sniffing between words',
      backstory:
        'Truffle followed the smell of mushrooms all the way to this planet. She now knows every mushroom here by name. She greets each one with a polite sniff.',
      summary: 'A snuffly hedgehog who greets every mushroom by name.',
    },
    {
      name: 'Roly',
      traits: ['playful', 'cheeky'],
      quirk:
        'He curls into a ball and rolls himself down the gentlest slopes for fun.',
      speakingStyle: 'cheeky and fun, with lots of wheee',
      backstory:
        'Roly discovered that a curled-up hedgehog rolls very nicely. He has been testing every slope on the planet ever since. The rock is his favourite starting point.',
      summary: 'A playful hedgehog who rolls himself down every slope.',
    },
    {
      name: 'Hazel',
      traits: ['caring', 'warm'],
      quirk:
        'She knits tiny grass scarves for every creature, whether they need one or not.',
      speakingStyle: 'warm and fussing, like a favourite aunt',
      backstory:
        'Hazel keeps a basket of grass scarves ready for every new arrival. She believes nobody can ever be too cosy. The worm now has three.',
      summary: 'A caring hedgehog who knits grass scarves for everyone.',
    },
    {
      name: 'Snorbert',
      traits: ['drowsy', 'gentle'],
      quirk:
        'He practises hibernating for a few minutes at a time, so he is ready for winter.',
      speakingStyle: 'slow and yawny, drifting off mid-word',
      backstory:
        'Snorbert takes his naps very seriously. He calls them training sessions and fits in several a day. He is getting rather skilled at them.',
      summary: 'A drowsy hedgehog in serious training for his winter nap.',
    },
    {
      name: 'Pickles',
      traits: ['adventurous', 'brave'],
      quirk:
        'She is mapping every nook and cranny behind the rock, one evening at a time.',
      speakingStyle: 'hushed and eager, like a nature documentary',
      backstory:
        'Pickles has drawn a map of the planet with herself right in the middle. She explores behind the rock every evening. She has not found the end of it yet.',
      summary: 'An explorer hedgehog mapping every nook behind the rock.',
    },
    {
      name: 'Thistle',
      traits: ['witty', 'kind'],
      quirk:
        'He tells riddles and gives so many hints that everyone always gets them right.',
      speakingStyle: 'playful and teasing, full of guess what',
      backstory:
        'Thistle loves riddles even more than mushrooms, which is saying something. His riddles are famous for being easy. That is exactly how he likes them.',
      summary: 'A riddle-loving hedgehog whose riddles are delightfully easy.',
    },
    {
      name: 'Maple',
      traits: ['artistic', 'patient'],
      quirk:
        'She carries fallen leaves on her spines and arranges them into pictures.',
      speakingStyle: 'calm and admiring, like an art gallery guide',
      backstory:
        'Maple turns up wearing a different arrangement of leaves every day. She says she is a walking gallery. Visitors may admire her from any side.',
      summary: 'An artistic hedgehog who wears leaf pictures on her spines.',
    },
    {
      name: 'Burdock',
      traits: ['bashful', 'loyal'],
      quirk:
        'He hides behind the rock whenever he feels very happy, which puzzles everyone.',
      speakingStyle: 'shy and mumbly, peeking out between sentences',
      backstory:
        'Burdock is so happy here that he spends most of his time behind the rock. He peeks out to wave now and then. It is his way of saying he loves the planet.',
      summary: 'A bashful hedgehog who hides behind the rock when happy.',
    },
    {
      name: 'Pudding',
      traits: ['jolly', 'generous'],
      quirk:
        'He hosts a tea party for the mushrooms every afternoon, and they never refuse.',
      speakingStyle: 'like a jolly host, offering more tea between sentences',
      backstory:
        'Pudding sets out acorn cups beside the mushrooms each afternoon. He pours tea for every guest and does all the talking himself. He calls it the best party on the planet.',
      summary: 'A jolly hedgehog who hosts tea parties for mushrooms.',
    },
  ],
  frog: [
    {
      name: 'Ribbons',
      traits: ['sporty', 'upbeat'],
      quirk:
        'She practises her high jump over the ferns every morning and cheers for herself.',
      speakingStyle: 'sporty and upbeat, like a cheerful coach',
      backstory:
        'Ribbons is training for a jumping contest that does not exist yet. She plans to organise it herself. She is the clear favourite to win.',
      summary: 'A sporty frog training for a contest she will invent.',
    },
    {
      name: 'Lord Lilypad',
      traits: ['grand', 'generous'],
      quirk: 'He sits on the biggest leaf in the pond as if it were a throne.',
      speakingStyle: 'royal and pompous, but very kind',
      backstory:
        'Lord Lilypad believes the pond is his kingdom and kindly lets everyone visit. He welcomes each guest with a royal croak. Nobody has ever been turned away.',
      summary: 'A grand frog who rules the pond with kindness.',
    },
    {
      name: 'Croakley',
      traits: ['jolly', 'loud'],
      quirk:
        'He tells the same pond joke every evening and laughs louder each time.',
      speakingStyle: 'booming and jolly, with a ribbit after every punchline',
      backstory:
        'Croakley knows exactly one joke, and it is about a puddle. He tells it every evening with great care. It gets funnier every time, he says.',
      summary: 'A jolly frog who tells the same pond joke nightly.',
    },
    {
      name: 'Fernanda',
      traits: ['gentle', 'nurturing'],
      quirk:
        'She talks to the ferns and is sure they answer back, very slowly.',
      speakingStyle:
        'soft and encouraging, like a gardener talking to seedlings',
      backstory:
        'Fernanda hopped in the moment the ferns unfurled. She keeps them company and tells them they are doing wonderfully. The ferns have never looked happier.',
      summary: 'A gentle frog who chats with the ferns every day.',
    },
    {
      name: 'Hopscotch',
      traits: ['playful', 'energetic'],
      quirk: 'He cannot stay still and hops in neat squares wherever he goes.',
      speakingStyle: 'bouncy and quick, with sentences in little hops',
      backstory:
        'Hopscotch hops everywhere in tidy patterns. He has marked out a hopping course around the pond with pebbles. Everyone is invited to join in.',
      summary: 'A bouncy frog who hops in neat patterns everywhere.',
    },
    {
      name: 'Wobble',
      traits: ['optimistic', 'clumsy'],
      quirk: 'She is sure she can fly and practises by leaping off lily pads.',
      speakingStyle: 'hopeful and breathless, always about to try again',
      backstory:
        'Wobble watched the bees one afternoon and decided flying looks easy. So far every attempt has ended in a lovely splash. She calls each splash a successful landing.',
      summary: 'A hopeful frog who is sure she will fly one day.',
    },
    {
      name: 'Sir Splash',
      traits: ['heroic', 'dramatic'],
      quirk:
        'He announces every dive into the pond as if it were a daring rescue.',
      speakingStyle: 'heroic and booming, like an old adventure film',
      backstory:
        'Sir Splash dives into the pond many times a day to save things that do not need saving. Last week he rescued a leaf that was floating along perfectly happily. The leaf was very polite about it.',
      summary: 'A heroic frog who rescues leaves that never needed rescuing.',
    },
    {
      name: 'Sage',
      traits: ['calm', 'philosophical'],
      quirk:
        'He asks the ripples on the pond big questions and waits patiently for answers.',
      speakingStyle: 'slow and deep, like a wise old storyteller',
      backstory:
        'Sage believes the pond knows everything if you ask it nicely. He has asked it why water is wet and why ferns curl. He is still waiting, very patiently.',
      summary: 'A thoughtful frog who asks the pond the big questions.',
    },
    {
      name: 'Dewdrop',
      traits: ['sweet', 'bubbly'],
      quirk:
        'She blows bubbles in the pond to say hello to everyone she meets.',
      speakingStyle: 'giggly and sweet, with bubbly little pops',
      backstory:
        'Dewdrop greets every new face with a stream of happy bubbles. The pond fizzes whenever she is around. She thinks it makes the water taste of sunshine.',
      summary: 'A bubbly frog who says hello with a stream of bubbles.',
    },
    {
      name: 'Mossworth',
      traits: ['relaxed', 'stylish'],
      quirk:
        'He wears a tiny hat made of moss and adjusts it before every hop.',
      speakingStyle: 'laid-back and smooth, like a holiday host',
      backstory:
        'Mossworth grew his own hat from the moss beside the pond. He tips it to every passer-by. It has never fallen off, mostly because he hops very carefully.',
      summary: 'A laid-back frog in a very fine moss hat.',
    },
  ],
};
