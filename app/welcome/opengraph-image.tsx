import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Welcome to WeWrite';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#000',
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '60px',
          fontFamily: 'system-ui',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blurred gradient blobs */}
        <div
          style={{
            position: 'absolute',
            top: '-300px',
            left: '-150px',
            width: '800px',
            height: '800px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-350px',
            right: '-100px',
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.35) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Subtle sparkles in background */}
        <div style={{ position: 'absolute', top: '80px', left: '120px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.8)' }} />
        <div style={{ position: 'absolute', top: '150px', right: '180px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.6)' }} />
        <div style={{ position: 'absolute', top: '200px', left: '350px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />
        <div style={{ position: 'absolute', top: '100px', right: '400px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />

        {/* Left side - Marketing copy */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '50%',
            paddingRight: '40px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: '#fff',
              marginBottom: '24px',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              letterSpacing: '-0.02em',
            }}
          >
            Write. Publish. Earn.
          </div>
          <div
            style={{
              fontSize: '26px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: 1.5,
              marginBottom: '40px',
            }}
          >
            Join thousands of writers sharing their ideas and getting paid for their work on WeWrite.
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
              <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Beautiful, distraction-free editor
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Get paid by sponsors
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
              <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Build your audience
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Allocation bar visualization */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '50%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Allocation bar card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              width: '420px',
              position: 'relative',
            }}
          >
            {/* Sparkles around the allocation bar indicating donation */}
            <div style={{ position: 'absolute', top: '-8px', left: '60px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 1)', boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)' }} />
            <div style={{ position: 'absolute', top: '20px', left: '30px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.9)', boxShadow: '0 0 6px rgba(34, 197, 94, 0.7)' }} />
            <div style={{ position: 'absolute', top: '-12px', left: '120px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.8)', boxShadow: '0 0 10px rgba(34, 197, 94, 0.9)' }} />
            <div style={{ position: 'absolute', top: '10px', right: '80px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.7)', boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)' }} />
            <div style={{ position: 'absolute', top: '-5px', right: '40px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.9)', boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)' }} />
            <div style={{ position: 'absolute', top: '25px', left: '180px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.6)', boxShadow: '0 0 4px rgba(34, 197, 94, 0.5)' }} />

            {/* Moving sparkle trail effect */}
            <div style={{ position: 'absolute', top: '-15px', left: '90px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 1)', boxShadow: '0 0 12px rgba(255, 255, 255, 0.9), 0 0 20px rgba(34, 197, 94, 0.6)' }} />
            <div style={{ position: 'absolute', top: '-10px', left: '95px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />
            <div style={{ position: 'absolute', top: '-5px', left: '100px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.4)' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>
                Support this page
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
                12 sponsors
              </div>
            </div>

            {/* Allocation bar */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '20px',
                boxShadow: '0 0 30px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* Filled portion - representing allocated amount */}
              <div
                style={{
                  width: '65%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  $6.50/mo
                </div>
              </div>
              {/* Empty portion */}
              <div
                style={{
                  width: '35%',
                  height: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  +$3.50
                </div>
              </div>
            </div>

            {/* Recent sponsor activity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#fff',
                }}
              >
                J
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '14px', color: '#fff' }}>
                  @jamie just donated
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  2 minutes ago
                </div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '16px', fontWeight: '600', color: '#22C55E' }}>
                +$2.00
              </div>
            </div>
          </div>
        </div>

        {/* Gradient fade above footer */}
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '0px',
          right: '0px',
          height: '80px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 1) 100%)',
          pointerEvents: 'none'
        }} />

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '0px',
            left: '0px',
            right: '0px',
            height: '100px',
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '60px',
            paddingRight: '60px',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              backgroundColor: '#000',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 1024 1024" fill="none">
              <path d="M807.513 284.461C799.889 320.509 788.451 359.892 778.437 396.615C766.615 439.966 756.536 480.373 753.156 515.281C749.678 551.207 754.227 573.071 762.908 585.385C769.816 595.183 785.543 607.377 829.035 607.377H1122.75C1122.75 607.377 1122.75 607.377 1122.75 647.377C1122.75 687.377 1122.75 687.377 1122.75 687.377H829.035C770.764 687.377 724.896 670.305 697.524 631.482C693.259 625.433 689.638 619.11 686.583 612.583C679.171 623.626 671.233 633.803 662.675 642.852C637.962 668.978 606.295 687.377 567.148 687.377C539.55 687.377 516.843 675.307 501.395 655.179C488.869 638.858 482.326 618.93 478.802 599.765C476.758 603.027 474.698 606.224 472.619 609.348C459.473 629.104 444.546 647.631 427.737 661.594C411.049 675.456 389.346 687.377 363.62 687.377C335.259 687.377 312.464 674.033 298.188 652.23C285.618 633.035 281.017 609.55 279.487 588.205C279.014 581.6 278.809 574.736 278.841 567.669C265.771 584.251 251.83 599.957 237.025 614.186C194.293 655.254 140.739 687.377 77.6191 687.377H-171.243C-171.245 687.373 -171.246 686.997 -171.246 647.377C-171.246 607.757 -171.245 607.381 -171.243 607.377H77.6191C112.164 607.377 146.87 589.875 181.591 556.506C216.206 523.238 247.246 477.52 273.508 429.641C299.595 382.081 319.984 334.215 333.889 298.053C335.715 293.302 337.425 288.761 339.019 284.461H423.957C421.696 291.061 418.922 298.946 415.647 307.881C413.951 313.069 412.157 318.625 410.295 324.498C398.688 361.105 384.544 409.469 373.99 457.467C363.232 506.394 357.048 551.315 359.282 582.486C360.281 596.426 362.754 603.931 364.457 607.257C366.073 606.906 370.038 605.522 376.619 600.056C385.17 592.952 395.132 581.385 406.018 565.027C427.737 532.389 448.844 487.28 467.565 440.034C486.121 393.208 501.615 346.141 512.5 310.63C513.877 306.137 515.178 301.836 516.4 297.75C517.667 293.029 518.879 288.588 520.021 284.461H603.504C603.072 286.017 602.601 287.711 602.089 289.533C599.896 297.341 596.968 307.537 593.381 319.549C592.291 323.622 591.16 327.91 589.999 332.389C580.816 367.822 569.915 414.587 562.658 460.955C555.254 508.265 552.281 551.4 556.795 581.196C559.067 596.197 562.658 603.605 564.857 606.471C565.577 607.408 565.087 607.377 567.148 607.377C578.644 607.377 590.564 602.67 604.556 587.878C619.265 572.327 633.963 547.832 648.773 513.907C675.247 453.268 697.749 373.224 723.142 284.461H807.513Z" fill="white"/>
            </svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>WeWrite</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
