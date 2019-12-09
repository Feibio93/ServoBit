﻿

/**
  * Pre-Defined LED colours
  */
enum vColors
{
    //% block=red
    Red = 0xff0000,
    //% block=orange
    Orange = 0xffa500,
    //% block=yellow
    Yellow = 0xffff00,
    //% block=green
    Green = 0x00ff00,
    //% block=blue
    Blue = 0x0000ff,
    //% block=indigo
    Indigo = 0x4b0082,
    //% block=violet
    Violet = 0x8a2be2,
    //% block=purple
    Purple = 0xff00ff,
    //% block=white
    White = 0xffffff,
    //% block=black
    Black = 0x000000
}

/**
 * Custom blocks
 */
//% weight=50 color=#a93135 icon="\uf0e4"
namespace ServoBit
{
    let neoStrip: neopixel.Strip;
    let _flashing = false;

// Servo PCA9685
    let PCA = 0x40;	// i2c address of PCA9685 servo controller
    let initI2C = false;
    let _i2cError = 0;
    let SERVOS = 0x06; // first servo address for start byte low
    let servoTarget: number[] = [];
    let servoActual: number[] = [];

// Helper functions

    // initialise the servo driver and the offset array values
    function initPCA(): void
    {

        let i2cData = pins.createBuffer(2);
        initI2C = true;

        i2cData[0] = 0;		// Mode 1 register
        i2cData[1] = 0x10;	// put to sleep
        pins.i2cWriteBuffer(PCA, i2cData, false);

        i2cData[0] = 0xFE;	// Prescale register
        i2cData[1] = 101;	// set to 60 Hz
        pins.i2cWriteBuffer(PCA, i2cData, false);

        i2cData[0] = 0;		// Mode 1 register
        i2cData[1] = 0x81;	// Wake up
        pins.i2cWriteBuffer(PCA, i2cData, false);

        for (let servo=0; servo<16; servo++)
        {
            i2cData[0] = SERVOS + servo*4 + 0;	// Servo register
            i2cData[1] = 0x00;			// low byte start - always 0
            _i2cError = pins.i2cWriteBuffer(PCA, i2cData, false);

            i2cData[0] = SERVOS + servo*4 + 1;	// Servo register
            i2cData[1] = 0x00;			// high byte start - always 0
            pins.i2cWriteBuffer(PCA, i2cData, false);

            servoTarget[servo]=0;
            servoActual[servo]=0;
        }
    }

    /**
      * Initialise all servos to Angle=0
      */
    //% blockId="zeroServos"
    //% block
    //% subcategory=Servos
    export function zeroServos(): void
    {
        for (let i=0; i<16; i++)
            setServo(i, 0);
    }

    /**
      * Set Servo Position by Angle
      * @param servo Servo number (0 to 15)
      * @param angle degrees to turn servo (-90 to +90)
      */
    //% blockId="an_setServo" block="set servo %servo| to angle %angle"
    //% weight=70
    //% angle.min=-90 angle.max.max=90
    //% subcategory=Servos
    export function setServo(servo: number, angle: number): void
    {
        if (initI2C == false)
        {
            initPCA();
        }
        // two bytes need setting for start and stop positions of the servo
        // servos start at SERVOS (0x06) and are then consecutive blocks of 4 bytes
        // the start position (always 0x00) is set during init for all servos

        let i2cData = pins.createBuffer(2);
        let start = 0;
        angle = Math.max(Math.min(90, angle),-90);
        let stop = 369 + angle * 223 / 90;

        i2cData[0] = SERVOS + servo*4 + 2;	// Servo register
        i2cData[1] = (stop & 0xff);		// low byte stop
        pins.i2cWriteBuffer(PCA, i2cData, false);

        i2cData[0] = SERVOS + servo*4 + 3;	// Servo register
        i2cData[1] = (stop >> 8);		// high byte stop
        pins.i2cWriteBuffer(PCA, i2cData, false);
        servoActual[servo] = angle;
    }

    /**
      * Move Servo o Target Position at selected Speed
      * @param servo Servo number (0 to 15)
      * @param angle degrees to turn to (-90 to +90)
      * @parame speed degrees per second to move (0 to 1000)
      */
    //% blockId="moveServo" block="move servo %servo| to angle %angle| at speed %speed| degrees/sec"
    //% weight=70
    //% angle.min=-90 angle.max.max=90
    //% speed.min=1 speed.max=1000
    //% subcategory=Servos
    export function moveServo(servo: number, angle: number, speed: number): void
    {
        if (initI2C == false)
        {
            initPCA();
        }
        // two bytes need setting for start and stop positions of the servo
        // servos start at SERVOS (0x06) and are then consecutive blocks of 4 bytes
        // the start position (always 0x00) is set during init for all servos

        let i2cData = pins.createBuffer(2);
        let start = 0;
        angle = Math.max(Math.min(90, angle),-90);
        let stop = 369 + angle * 223 / 90;

        i2cData[0] = SERVOS + servo*4 + 2;	// Servo register
        i2cData[1] = (stop & 0xff);		// low byte stop
        pins.i2cWriteBuffer(PCA, i2cData, false);

        i2cData[0] = SERVOS + servo*4 + 3;	// Servo register
        i2cData[1] = (stop >> 8);		// high byte stop
        pins.i2cWriteBuffer(PCA, i2cData, false);
        servoActual[servo] = angle;
    }

    /**
      * Get Servo Current Actual Position
      * @param servo Servo number (0 to 15)
      */
    //% blockId="getServoActual" block="get servo %servo| actual position"
    //% weight=10
    //% subcategory=Servos
    export function getServoActual(servo: number): number
    {
        return servoActual[servo];
    }

    /**
      * Get Servo Target Position
      * @param servo Servo number (0 to 15)
      */
    //% blockId="getServoTarget" block="get servo %servo| target position"
    //% weight=5
    //% subcategory=Servos
    export function getServoTarget(servo: number): number
    {
        return servoTarget[servo];
    }


// LED Blocks

    // create a neopixel strip if not got one already. Default to brightness 40
    function neo(): neopixel.Strip
    {
        if (!neoStrip)
        {
            neoStrip = neopixel.create(DigitalPin.P16, 4, NeoPixelMode.RGB);
            neoStrip.setBrightness(40);
        }
        return neoStrip;
    }

    // update LEDs always
    function updateLEDs(): void
    {
        neo().show();
    }

    /**
      * Sets the LED to a given color (range 0-255 for r, g, b).
      * @param rgb RGB color of the LED
      */
    //% blockId="val_set_led_color" block="set LED to %rgb=val_colours"
    //% weight=100
    //% subcategory=LEDs
    export function setLedColor(rgb: number)
    {
        stopFlash();
        setLedColorRaw(rgb);
    }

    function setLedColorRaw(rgb: number)
    {
        neo().showColor(rgb);
        updateLEDs();
    }

    /**
      * Clear LED
      */
    //% blockId="val_led_clear" block="clear LED"
    //% weight=90
    //% subcategory=LEDs
    export function ledClear(): void
    {
        stopFlash();
        ledClearRaw();
    }

    function ledClearRaw(): void
    {
        neo().clear();
        updateLEDs();
    }

    /**
     * Set the brightness of the LED
     * @param brightness a measure of LED brightness in 0-255. eg: 40
     */
    //% blockId="val_led_brightness" block="set LED brightness %brightness"
    //% brightness.min=0 brightness.max=255
    //% weight=70
    //% subcategory=LEDs
    export function ledBrightness(brightness: number): void
    {
        neo().setBrightness(brightness);
        updateLEDs();
    }

    /**
      * Get numeric value of colour
      *
      * @param color Standard RGB Led Colours
      */
    //% blockId="val_colours" block=%color
    //% weight=50
    //% subcategory=LEDs
    export function vColours(color: vColors): number
    {
        return color;
    }

    /**
      * Convert from RGB values to colour number
      *
      * @param red Red value of the LED (0 to 255)
      * @param green Green value of the LED (0 to 255)
      * @param blue Blue value of the LED (0 to 255)
      */
    //% blockId="val_convertRGB" block="convert from red %red| green %green| blue %blue"
    //% weight=20
    //% subcategory=LEDs
    export function convertRGB(r: number, g: number, b: number): number
    {
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    /**
      * Start Flashing
      * @param color the colour to flash
      * @param delay time in ms for each flash, eg: 100,50,200,500
      */
    //% blockId="startFlash" block="start flash %color=val_colours| at %delay|(ms)"
    //% subcategory=LEDs
    //% delay.min=1 delay.max=10000
    //% weight=15
    export function startFlash(color: number, delay: number): void
    {
        if(_flashing == false)
        {
            _flashing = true;
            control.inBackground(() =>
            {
                while (_flashing)
                {                                
                    setLedColorRaw(color);
                    basic.pause(delay);
                    if (! _flashing)
                        break;
                    ledClearRaw();
                    basic.pause(delay);
                }
            })
        }
    }

    /**
      * Stop Flashing
      */
    //% block
    //% subcategory=LEDs
    //% weight=10
    export function stopFlash(): void
    {
        _flashing = false;
    }


}
