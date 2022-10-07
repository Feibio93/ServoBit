

/**
  * Pre-Defined LED colours
  */
enum vColors
{
    //% block=red
    Rosso = 0xff0000,
    //% block=orange
    Arancione = 0xffa500,
    //% block=yellow
    Giallo = 0xffff00,
    //% block=green
    Verde = 0x00ff00,
    //% block=blue
    Blu = 0x0000ff,
    //% block=indigo
    Celeste = 0x4b0082,
    //% block=violet
    Viola = 0x8a2be2,
    //% block=purple
    Fucsia = 0xff00ff,
    //% block=white
    Bianco = 0xffffff,
    //% block=black
    Nero = 0x000000
}

/**
 * Custom blocks
 */
//% weight=50 color=#e7660b icon="\uf1da"
namespace ServoBit
{
    let fireBand: fireled.Band;
    let _flashing = false;

// Servo PCA9685
    let PCA = 0x40;	// i2c address of PCA9685 servo controller
    let initI2C = false;
    let _i2cError = 0;
    let SERVOS = 0x06; // first servo address for start byte low
    let servoTarget: number[] = [];
    let servoActual: number[] = [];
    let servoCancel: boolean[] = [];

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
            servoCancel[servo]=false;
        }
    }

    /**
      * Initialise all servos to Angle=0
      */
    //% blockId="centreServos"
    //% block="Inizializza tutti i servo all'angolo 0"
    //% subcategory=Servomotori
    export function centreServos(): void
    {
        for (let i=0; i<16; i++)
            setServo(i, 0);
    }

    /**
      * Set Servo Position by Angle
      * @param servo Servo number (0 to 15)
      * @param angle degrees to turn servo (-90 to +90)
      */
    //% blockId="an_setServo" block="Imposta l'angolo del servo %servo| a %angle| gradi"
    //% weight=70
    //% angle.min=-90 angle.max.max=90
    //% subcategory=Servomotori
    export function setServo(servo: number, angle: number): void
    {
        setServoRaw(servo, angle);
        servoTarget[servo] = angle;
    }

    function setServoRaw(servo: number, angle: number): void
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
      * Move Servo to Target Position at selected Speed
      * @param servo Servo number (0 to 15)
      * @param angle degrees to turn to (-90 to +90)
      * @param speed degrees per second to move (1 to 1000) eg: 60
      */
    //% blockId="moveServo" block="Aziona il servo %servo| fino all'angolo di %angle| gradi alla velocità di %speed| gradi/sec"
    //% weight=70
    //% angle.min=-90 angle.max.max=90
    //% speed.min=1 speed.max=1000
    //% subcategory=Servomotori
    export function moveServo(servo: number, angle: number, speed: number): void
    {
        let step = 1;
        let delay = 10; // 10ms delay between steps
        if(servoTarget[servo] != servoActual[servo])   // cancel any existing movement on this servo?
        {
            servoCancel[servo] = true;
            while(servoCancel[servo])
                basic.pause(1);  // yield
        }
        angle = Math.max(Math.min(90, angle),-90);
        speed = Math.max(Math.min(1000, speed),1);
        delay = Math.round(1000/speed);
        servoTarget[servo] = angle;
        if (angle < servoActual[servo])
            step = -1;
        control.inBackground(() =>
        {
            while (servoActual[servo] != servoTarget[servo])
            {
                if(servoCancel[servo])
                {
                    servoCancel[servo] = false;
                    break;
                }
                setServoRaw(servo, servoActual[servo]+step);
                basic.pause(delay);
            }
        })
    }

    /**
      * Get Servo Current Actual Position
      * @param servo Servo number (0 to 15)
      */
    //% blockId="getServoActual" block="Posizione del servo %servo"
    //% weight=10
    //% subcategory=Servomotori
    export function getServoActual(servo: number): number
    {
        return servoActual[servo];
    }

    /**
      * Get Servo Target Position
      * @param servo Servo number (0 to 15)
      */
    //% blockId="getServoTarget" block="Posizione da raggiungere del servo %servo"
    //% weight=8
    //% subcategory=Servomotori
    export function getServoTarget(servo: number): number
    {
        return servoTarget[servo];
    }

    /**
      * Check if servo has reached target
      * @param servo Servo number (0 to 15)
      */
    //% blockId="isServoDone" block="Il servo %servo| ha raggiunto la posizione?"
    //% weight=5
    //% subcategory=Servomotori
    export function isServoDone(servo: number): boolean
    {
        return servoTarget[servo]==servoActual[servo];
    }

    /**
      * Wait until servo has reached target position
      * @param servo Servo number (0 to 15)
      */
    //% blockId="waitServo" block="Attendi il servo %servo"
    //% weight=5
    //% subcategory=Servomotori
    export function waitServo(servo: number): void
    {
        while (servoActual[servo] != servoTarget[servo]) // what if nothing is changing these values?
            basic.pause(10);
    }



// FireLed Status Blocks

    // create a FireLed band if not got one already. Default to brightness 40
    function fire(): fireled.Band
    {
        if (!fireBand)
        {
            fireBand = fireled.newBand(DigitalPin.P16, 1);
            fireBand.setBrightness(40);
        }
        return fireBand;
    }

    // Always update status LED
    function updateLEDs(): void
    {
        fire().updateBand();
    }

    /**
      * Sets the status LED to a given color (range 0-255 for r, g, b).
      * @param rgb colour of the LED
      */
    //% blockId="val_set_led_color" block="Imposta il LED al colore %rgb=val_colours"
    //% weight=100
    //% subcategory=Led
    export function setLedColor(rgb: number)
    {
        stopFlash();
        setLedColorRaw(rgb);
    }

    function setLedColorRaw(rgb: number)
    {
        fire().setBand(rgb);
        updateLEDs();
    }

    /**
      * Clear LED
      */
    //% blockId="val_led_clear" block="Spegni il LED"
    //% weight=70
    //% subcategory=Led
    export function ledClear(): void
    {
        stopFlash();
        ledClearRaw();
    }

    function ledClearRaw(): void
    {
        fire().clearBand();
        updateLEDs();
    }

    /**
     * Set the brightness of the LED
     * @param brightness a measure of LED brightness in 0-255. eg: 40
     */
    //% blockId="val_led_brightness" block="Imposta la luminosità del LED a %brightness|%"
    //% brightness.min=0 brightness.max=100
    //% weight=50
    //% subcategory=Led
    export function ledBrightness(brightness: number): void
    {
        fire().setBrightness(brightness*2.55);
        updateLEDs();
    }

    /**
      * Get numeric value of colour
      * @param color Standard RGB Led Colours eg: #ff0000
      */
    //% blockId="val_colours" block=%color
    //% blockHidden=false
    //% weight=60
    //% subcategory=Led
    //% blockGap=8
    //% shim=TD_ID colorSecondary="#e7660b"
    //% color.fieldEditor="colornumber"
    //% color.fieldOptions.decompileLiterals=true
    //% color.defl='#ff0000'
    //% color.fieldOptions.colours='["#FF0000","#659900","#18E600","#80FF00","#00FF00","#FF8000","#D82600","#B24C00","#00FFC0","#00FF80","#FFC000","#FF0080","#FF00FF","#B09EFF","#00FFFF","#FFFF00","#8000FF","#0080FF","#0000FF","#FFFFFF","#FF8080","#80FF80","#40C0FF","#999999","#000000"]'
    //% color.fieldOptions.columns=5
    //% color.fieldOptions.className='rgbColorPicker'
    export function vColours(color: number): number
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
    //% blockId="val_convertRGB" block="Converti da rosso %red| verde %green| blu %blue"
    //% weight=40
    //% subcategory=Led
    export function convertRGB(r: number, g: number, b: number): number
    {
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    /**
      * Start Flashing
      * @param color the colour to flash
      * @param delay time in ms for each flash, eg: 100,50,200,500
      */
    //% blockId="startFlash" block="Comincia a lampeggiare di colore %color=val_colours| ogni %delay|(ms)"
    //% subcategory=Led
    //% delay.min=1 delay.max=10000
    //% weight=90
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
    //% blockId="stopFlash" block="Interrompi il lampeggiamento"
    //% subcategory=Led
    //% weight=80
    export function stopFlash(): void
    {
        _flashing = false;
    }


}
