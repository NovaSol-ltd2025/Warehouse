import React, { useState } from 'react';

interface NovasolLogoProps {
  className?: string;
  size?: number;
  driveFileId?: string;
}

export const NovasolLogo: React.FC<NovasolLogoProps> = ({
  className = '',
  size = 95,
  driveFileId = '1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const driveImageUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;

  if (!imageFailed && driveFileId) {
    return (
      <img
        src={driveImageUrl}
        alt="ห้างหุ้นส่วนจำกัด โนวาโซล - NOVASOL LIMITED PARTNERSHIP"
        width={size}
        height={size}
        onError={() => setImageFailed(true)}
        className={`object-contain inline-block rounded-full ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  // Vector SVG Fallback with Chakra Petch font styling
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Top curved path for Thai text */}
        <path
          id="upper-curve"
          d="M 32 100 A 68 68 0 0 1 168 100"
          fill="none"
        />
        {/* Bottom curved path for English text */}
        <path
          id="lower-curve"
          d="M 166 100 A 66 66 0 0 1 34 100"
          fill="none"
        />
      </defs>

      {/* Outer thick decorative border */}
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="#ffffff"
        stroke="#111827"
        strokeWidth="3.5"
      />

      {/* Inner thin border */}
      <circle
        cx="100"
        cy="100"
        r="86"
        fill="none"
        stroke="#111827"
        strokeWidth="1.5"
      />

      {/* Center circle backing */}
      <circle
        cx="100"
        cy="100"
        r="54"
        fill="none"
        stroke="#111827"
        strokeWidth="1.5"
      />

      {/* Upper text: ห้างหุ้นส่วนจำกัด โนวาโซล */}
      <text
        fill="#111827"
        fontSize="12.5"
        fontWeight="bold"
        fontFamily="'Chakra Petch', sans-serif"
        letterSpacing="0.8"
      >
        <textPath
          href="#upper-curve"
          startOffset="50%"
          textAnchor="middle"
        >
          ห้างหุ้นส่วนจำกัด โนวาโซล
        </textPath>
      </text>

      {/* Center text: NOVASOL */}
      <text
        x="100"
        y="99"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0f172a"
        fontSize="21"
        fontWeight="900"
        letterSpacing="1.2"
        fontFamily="'Chakra Petch', sans-serif"
      >
        NOVASOL
      </text>

      {/* Center underline decorative accent line */}
      <line
        x1="55"
        y1="112"
        x2="145"
        y2="112"
        stroke="#111827"
        strokeWidth="1.2"
      />

      {/* Lower text: LIMITED PARTNERSHIP */}
      <text
        fill="#111827"
        fontSize="10"
        fontWeight="bold"
        fontFamily="'Chakra Petch', sans-serif"
        letterSpacing="1.4"
      >
        <textPath
          href="#lower-curve"
          startOffset="50%"
          textAnchor="middle"
        >
          LIMITED PARTNERSHIP
        </textPath>
      </text>
    </svg>
  );
};
