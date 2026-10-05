import { useState } from "react";
import { cn } from "@/lib/utils";

// A hard-coded emoji grid with category tabs (tools.md §1, tool 14), in place of emoji-picker-react.
// Each category is one string, split into emoji by grapheme.

const CATEGORIES: { name: string; icon: string; emoji: string }[] = [
  {
    name: "Smileys",
    icon: "😀",
    emoji:
      "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👻👽🤖",
  },
  {
    name: "People",
    icon: "👍",
    emoji:
      "👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍💅🤳💪🦾🦵🦶👂👃🧠👀👁👅👄👶🧒👦👧🧑👱👨🧔👩🧓👴👵🙍🙎🙅🙆💁🙋🧏🙇🤦🤷👮🕵💂👷🤴👸👳👲🧕🤵👰🤰🤱👼🎅🤶🦸🦹🧙🧚🧛🧜🧝🧞🧟💆💇🚶🧍🧎🏃💃🕺👯🧖🧗🤺🏇⛷🏂🏌🏄🚣🏊⛹🏋🚴🚵🤸🤼🤽🤾🤹🧘",
  },
  {
    name: "Nature",
    icon: "🌿",
    emoji:
      "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦟🦗🕷🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐈🐓🦃🦚🦜🦢🦩🕊🐇🦝🦨🦡🦦🦥🐁🐀🐿🦔🌵🎄🌲🌳🌴🌱🌿☘🍀🎍🎋🍃🍂🍁🍄🌾💐🌷🌹🥀🌺🌸🌼🌻🌞🌝🌛🌜🌚🌕🌖🌗🌘🌑🌒🌓🌔🌙🌎🌍🌏🪐💫⭐🌟✨⚡☄💥🔥🌪🌈☀🌤⛅🌥☁🌦🌧⛈🌩🌨❄☃⛄🌬💨💧💦☔☂🌊🌫",
  },
  {
    name: "Food",
    icon: "🍔",
    emoji:
      "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🫑🌽🥕🧄🧅🥔🍠🥐🥯🍞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥩🍗🍖🌭🍔🍟🍕🥪🥙🧆🌮🌯🥗🥘🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛🍼☕🍵🧃🥤🍶🍺🍻🥂🍷🥃🍸🍹🧉🍾🧊",
  },
  {
    name: "Activities",
    icon: "⚽",
    emoji:
      "⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿🎯🎮🕹🎰🎲🧩♟🎭🎨🧵🧶🎼🎤🎧🎷🎸🎹🎺🎻🥁🎬🏆🥇🥈🥉🏅🎖🏵🎗🎫🎟🎪",
  },
  {
    name: "Travel",
    icon: "🚀",
    emoji:
      "🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🚚🚛🚜🛴🚲🛵🏍🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈🛫🛬🛩💺🛰🚀🛸🚁🛶⛵🚤🛥🛳⛴🚢⚓⛽🚧🚦🚥🗺🗿🗽🗼🏰🏯🏟🎡🎢🎠⛲⛱🏖🏝🏜🌋⛰🏔🗻🏕⛺🏠🏡🏘🏚🏗🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛⛪🕌🕍🛕🕋⛩🌅🌄🌠🎇🎆🌇🌆🏙🌃🌌🌉🌁",
  },
  {
    name: "Objects",
    icon: "💡",
    emoji:
      "⌚📱💻⌨🖥🖨🖱💽💾💿📀📷📸📹🎥📞☎📺📻🎙⏱⏰⌛⏳📡🔋🔌💡🔦🕯💸💵💰💳💎⚖🔧🔨⚒🛠⛏🔩⚙🧱⛓🧲🔫💣🧨🔪🗡⚔🛡🔮🧿💈⚗🔭🔬🩹🩺💊💉🧬🦠🧪🌡🧹🧺🧻🚽🚰🚿🛁🧼🧽🔑🗝🚪🛋🛏🧸🖼🛍🛒🎁🎈🎏🎀🎊🎉✉📩📨📧💌📥📤📦🏷📪📬📮📜📃📄📑🧾📊📈📉🗒🗓📆📅🗑📇🗃🗳🗄📋📁📂🗂🗞📰📓📔📒📕📗📘📙📚📖🔖🧷🔗📎🖇📐📏🧮📌📍✂🖊🖋✒🖌🖍📝✏🔍🔎🔏🔐🔒🔓",
  },
  {
    name: "Symbols",
    icon: "❤",
    emoji:
      "❤🧡💛💚💙💜🖤🤍🤎💔❣💕💞💓💗💖💘💝💟☮✝☪🕉☸✡🔯☯☦🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛✅☑✔❌❎➕➖➗➰➿〽✳✴❇‼⁉❓❔❕❗〰©®™🔟🔢🔣🔤🅰🆎🅱🆑🆒🆓ℹ🆕🆖🅾🆗🅿🆘🆙🆚⛔🚫💯💢♨🚷🚯🚳🚱🔞📵🚭⚠🚸🔱⚜🔰♻💹❇🌐💠Ⓜ🌀💤🏧🚾♿🔴🟠🟡🟢🔵🟣🟤⚫⚪🟥🟧🟨🟩🟦🟪🟫⬛⬜🔶🔷🔸🔹🔺🔻💬💭🗯♠♣♥♦🃏🎴🀄🔔🔕🎵🎶➡⬅⬆⬇↗↘↙↖↕↔🔄🔃🔁🔂▶⏩⏭⏯◀⏪⏮🔼⏫🔽⏬⏸⏹⏺⏏🔀",
  },
  {
    name: "Flags",
    icon: "🏁",
    emoji:
      "🏁🚩🎌🏴🏳🏳‍🌈🏴‍☠🇧🇩🇺🇸🇬🇧🇨🇦🇦🇺🇮🇳🇯🇵🇰🇷🇨🇳🇩🇪🇫🇷🇮🇹🇪🇸🇵🇹🇧🇷🇲🇽🇦🇷🇳🇱🇧🇪🇨🇭🇸🇪🇳🇴🇩🇰🇫🇮🇮🇪🇵🇱🇺🇦🇹🇷🇸🇦🇦🇪🇪🇬🇳🇬🇰🇪🇿🇦🇵🇰🇮🇩🇲🇾🇸🇬🇹🇭🇻🇳🇵🇭🇳🇿",
  },
];

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const split = (text: string) => [
  ...new Set([...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim())),
];
const GRIDS = CATEGORIES.map((category) => split(category.emoji));

/** The Emoji tool's picker: choose one, then click the board to place it. */
export function EmojiPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (emoji: string) => void;
}) {
  const [tab, setTab] = useState(0);
  const grid = GRIDS[tab] ?? [];

  return (
    <div
      // Not a dialog: the board's keys keep working, and the board stays clickable.
      role="group"
      aria-label="Emoji picker"
      className="absolute top-6 left-20 z-10 flex w-[316px] flex-col border border-chrome bg-card"
    >
      <div role="tablist" aria-label="Emoji categories" className="flex border-b border-divider">
        {CATEGORIES.map((category, i) => (
          <button
            key={category.name}
            type="button"
            role="tab"
            aria-selected={i === tab}
            title={category.name}
            onClick={() => setTab(i)}
            className={cn(
              "flex h-9 flex-1 items-center justify-center text-base transition-colors duration-150 ease-standard",
              i === tab
                ? "bg-background shadow-[inset_0_-2px_0_var(--color-brand)]"
                : "hover:bg-background",
            )}
          >
            <span aria-hidden="true">{category.icon}</span>
            <span className="sr-only">{category.name}</span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={CATEGORIES[tab]?.name}
        className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto p-2"
      >
        {grid.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={emoji === value}
            onClick={() => onPick(emoji)}
            className={cn(
              "flex size-[34px] items-center justify-center text-xl transition-transform duration-100 ease-standard hover:scale-110 hover:bg-background motion-reduce:hover:scale-100",
              emoji === value && "bg-brand/40",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <p className="border-t border-divider px-3 py-2 text-xs text-muted-foreground">
        {value ? "Click the board to place it." : "Pick an emoji, then click the board."}
      </p>
    </div>
  );
}
