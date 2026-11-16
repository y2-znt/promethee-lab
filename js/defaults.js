/* Each image lives in assets/defaults as <name>.webp plus a <name>-thumb.webp (240x320) for the grid.
   credit is optional and printed at the bottom of the poster. */
const defaultImage = (title, name, credit = "") => ({
  title,
  src: `assets/defaults/${name}.webp`,
  thumb: `assets/defaults/${name}-thumb.webp`,
  credit,
});

const DEFAULT_IMAGES = [
  defaultImage("Stone bridge at dawn", "stone-bridge"),
  defaultImage("Painting", "painting-01"),
  defaultImage("Meadow hike", "meadow-hike"),
  defaultImage("Radiant figure", "radiant-figure"),
  defaultImage("Ancient tower", "ancient-tower"),
  defaultImage("Golden peaks", "golden-peaks"),
  defaultImage("Skybeam", "skybeam"),
  defaultImage("Canyon valley", "canyon-valley"),
  defaultImage("Forest sunset", "forest-sunset"),
  defaultImage("Cliff summit", "cliff-summit"),
  defaultImage("Golden plains", "golden-plains"),
  defaultImage("Misty canyon", "misty-canyon"),
  defaultImage("River valley", "river-valley"),
];
