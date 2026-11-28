// Playfield geometry and tuning. All game logic works in this 800x600 space;
// the renderer scales it to whatever size the canvas ends up on screen.
export const W = 800;
export const H = 600;
export const HUD_H = 54;           // top bar with score, level, lives and files
export const WALL = 14;
export const FIELD = { x: WALL, y: HUD_H + 10, w: W - WALL * 2, h: H - HUD_H - 10 };
export const BRICK_TOP = FIELD.y + 36;

export const PADDLE_Y = 556;        // top edge of the paddle
export const PADDLE_H = 14;
export const PADDLE_W = 110;        // same on every level; only power-ups change it
export const PADDLE_SPEED = 720;    // px/s with the keyboard
export const PADDLE_ACCEL = 9000;   // reaches full speed in ~0.08 s
export const POINTER_SPEED = 2600;  // px/s cap when following the mouse/finger

export const BALL_R = 6;
export const MAX_BOUNCE = Math.PI / 3; // 60 degrees either side of straight up
export const MIN_DY = 0.3;             // smallest allowed vertical part of the ball's direction
export const RAMP_TIME = 75;           // seconds for the ball to ramp from start to max speed
export const MAX_BALLS = 9;

export const NET_Y = 586;              // where the BACKUP barrier sits
export const PILL_W = 78;
export const FILE_PILL_W = 112;
export const PILL_H = 22;
export const PILL_SPEED = 150;
export const MAX_FALLING_PILLS = 3;
export const LASER_SPEED = 900;
export const LASER_COOLDOWN = 0.28;

export const START_LIVES = 3;
export const MAX_LIVES = 7;
export const SERVE_AUTO = 6;           // a served ball launches itself after this many seconds
export const CATCH_AUTO = 3;           // a ball caught by INGEST launches itself after this many seconds

// The "continue from level N" line on the title screen: tapping or clicking between these heights picks it.
export const CONTINUE_Y = 366;
export const CONTINUE_BAND = [346, 388];

export const STEP = 1 / 120;           // fixed simulation step
