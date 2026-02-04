import React from "react";

interface DynamicBookTemplateProps {
  title?: string;
  author?: string;
  coverColor?: string;
  spineColor?: string;
  borderColor?: string;
  cornerColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  onClick?: () => void;
  isInteractive?: boolean;
  className?: string;
}

const DynamicBookTemplate: React.FC<DynamicBookTemplateProps> = ({
  title = "Название книги",
  author = "Автор",
  coverColor = "#92400e",
  spineColor = "#8b4513",
  borderColor = "#8b4513",
  cornerColor = "#fbbf24",
  textColor = "#ffffff",
  width = 320,
  height = 384,
  onClick,
  isInteractive = false,
  className = ""
}) => {
  return (
    <div 
      className={`relative rounded-lg transform transition-all duration-300 hover:scale-105 ${className}`}
      style={{ 
        width: `${width}px`,
        height: `${height}px`,
        background: `linear-gradient(to bottom, ${coverColor}, ${coverColor}dd)`,
        cursor: isInteractive ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
        {/* Book Spine */}
        <div 
          className="absolute top-0 left-0 h-full rounded-l-lg border-r-2 overflow-hidden"
          style={{ 
            width: `${width / 8}px`,
            background: `linear-gradient(to bottom, ${spineColor}, ${spineColor}dd)`,
            borderColor: `${spineColor}bb`
          }}
        >
          {/* Spine Stitching Lines */}
          <div className="absolute inset-0">
            {Array.from({ length: Math.floor(height / 20) }, (_, i) => (
              <div
                key={i}
                className="absolute w-full h-0.5 opacity-60"
                style={{
                  top: `${20 + i * 20}px`,
                  background: `linear-gradient(to right, transparent, ${spineColor}aa, transparent)`,
                  boxShadow: `0 1px 0 ${spineColor}88`
                }}
              />
            ))}
          </div>
          
          {/* Spine Texture Pattern */}
          <div className="absolute inset-0 opacity-30">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="spineTexture" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="4" cy="4" r="0.5" fill={spineColor} opacity="0.3"/>
                  <circle cx="2" cy="2" r="0.3" fill={spineColor} opacity="0.2"/>
                  <circle cx="6" cy="6" r="0.3" fill={spineColor} opacity="0.2"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#spineTexture)" />
            </svg>
          </div>
          
          {/* Spine Highlight */}
          <div 
            className="absolute top-0 left-0 w-0.5 h-full opacity-40"
            style={{ 
              background: `linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)`
            }}
          />
          
          {/* Spine Shadow */}
          <div 
            className="absolute top-0 right-0 w-0.5 h-full opacity-30"
            style={{ 
              background: `linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)`
            }}
          />
        </div>
        
        {/* Leather Texture */}
        <div 
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{ background: `linear-gradient(to bottom, ${coverColor}, ${coverColor}dd)` }}
        >
          {/* Enhanced Leather Texture */}
          <div className="absolute inset-0 opacity-25">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="leatherTexture" width="30" height="30" patternUnits="userSpaceOnUse">
                  {/* Leather grain pattern */}
                  <path d="M0,15 Q15,5 30,15 Q15,25 0,15" 
                    stroke={coverColor} strokeWidth="0.3" fill="none" opacity="0.4"/>
                  <path d="M15,0 Q5,15 15,30 Q25,15 15,0" 
                    stroke={coverColor} strokeWidth="0.2" fill="none" opacity="0.3"/>
                  {/* Small texture dots */}
                  <circle cx="8" cy="8" r="0.8" fill={coverColor} opacity="0.2"/>
                  <circle cx="22" cy="22" r="0.6" fill={coverColor} opacity="0.15"/>
                  <circle cx="15" cy="5" r="0.4" fill={coverColor} opacity="0.1"/>
                  <circle cx="5" cy="25" r="0.5" fill={coverColor} opacity="0.12"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#leatherTexture)" />
            </svg>
          </div>
          
          {/* Enhanced Stitching Lines */}
          <div 
            className="absolute inset-0 border-2 border-dashed rounded-lg"
            style={{ borderColor: borderColor }}
          ></div>
          
          {/* Additional Stitching Details */}
          <div className="absolute inset-0">
            {/* Top stitching */}
            <div 
              className="absolute top-1 left-2 right-2 h-0.5 opacity-60"
              style={{ 
                background: `linear-gradient(to right, transparent, ${borderColor}aa, transparent)`,
                boxShadow: `0 1px 0 ${borderColor}88`
              }}
            />
            {/* Bottom stitching */}
            <div 
              className="absolute bottom-1 left-2 right-2 h-0.5 opacity-60"
              style={{ 
                background: `linear-gradient(to right, transparent, ${borderColor}aa, transparent)`,
                boxShadow: `0 1px 0 ${borderColor}88`
              }}
            />
            {/* Right stitching */}
            <div 
              className="absolute top-2 bottom-2 right-1 w-0.5 opacity-60"
              style={{ 
                background: `linear-gradient(to bottom, transparent, ${borderColor}aa, transparent)`,
                boxShadow: `1px 0 0 ${borderColor}88`
              }}
            />
          </div>
          
          {/* Enhanced Corners */}
          <div 
            className="absolute top-0 right-0 rounded-tr-lg border-2 shadow-inner overflow-hidden"
            style={{ 
              width: `${width / 12}px`,
              height: `${height / 12}px`,
              background: `linear-gradient(135deg, ${cornerColor}, ${cornerColor}dd, ${cornerColor}bb)`,
              borderColor: `${cornerColor}bb`,
              boxShadow: `inset 0 0 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)`
            }}
          >
            {/* Corner texture */}
            <div className="absolute inset-0 opacity-40">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="cornerTexture" width="6" height="6" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="0.5" fill={cornerColor} opacity="0.3"/>
                    <circle cx="1" cy="1" r="0.3" fill={cornerColor} opacity="0.2"/>
                    <circle cx="5" cy="5" r="0.3" fill={cornerColor} opacity="0.2"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cornerTexture)" />
              </svg>
            </div>
          </div>
          
          <div 
            className="absolute bottom-0 right-0 rounded-br-lg border-2 shadow-inner overflow-hidden"
            style={{ 
              width: `${width / 12}px`,
              height: `${height / 12}px`,
              background: `linear-gradient(45deg, ${cornerColor}, ${cornerColor}dd, ${cornerColor}bb)`,
              borderColor: `${cornerColor}bb`,
              boxShadow: `inset 0 0 4px rgba(0,0,0,0.3), 0 -2px 4px rgba(0,0,0,0.2)`
            }}
          >
            {/* Corner texture */}
            <div className="absolute inset-0 opacity-40">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="cornerTexture2" width="6" height="6" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="0.5" fill={cornerColor} opacity="0.3"/>
                    <circle cx="1" cy="1" r="0.3" fill={cornerColor} opacity="0.2"/>
                    <circle cx="5" cy="5" r="0.3" fill={cornerColor} opacity="0.2"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cornerTexture2)" />
              </svg>
            </div>
          </div>
          
          {/* Enhanced Corner Highlights */}
          <div 
            className="absolute top-0 right-0 rounded-tr-lg opacity-60"
            style={{ 
              width: `${width / 16}px`,
              height: `${height / 16}px`,
              background: `radial-gradient(circle at top left, ${cornerColor}cc, transparent)`
            }}
          ></div>
          <div 
            className="absolute bottom-0 right-0 rounded-br-lg opacity-60"
            style={{ 
              width: `${width / 16}px`,
              height: `${height / 16}px`,
              background: `radial-gradient(circle at bottom left, ${cornerColor}cc, transparent)`
            }}
          ></div>
          
          {/* Inner Border */}
          <div 
            className="absolute inset-2 rounded-lg"
            style={{ 
              background: `linear-gradient(to bottom, ${coverColor}dd, ${coverColor})`
            }}
          ></div>
          
          {/* Subtle Gradient Overlay */}
          <div 
            className="absolute inset-0 rounded-lg opacity-30"
            style={{ 
              background: `linear-gradient(to top, transparent, ${coverColor})`
            }}
          ></div>

          {/* Book Title and Author */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <h3 
              className="text-lg font-bold mb-2 leading-tight drop-shadow-lg"
              style={{ 
                color: textColor,
                textShadow: `2px 2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3)`
              }}
            >
              {title}
            </h3>
            <p 
              className="text-sm opacity-90 drop-shadow-md"
              style={{ 
                color: textColor,
                textShadow: `1px 1px 2px rgba(0,0,0,0.4)`
              }}
            >
              {author}
            </p>
          </div>
          
          {/* Volume and Depth Effects */}
          <div 
            className="absolute inset-0 rounded-lg opacity-20"
            style={{ 
              background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)`
            }}
          />
          
          {/* Subtle embossed effect */}
          <div 
            className="absolute inset-1 rounded-lg opacity-10"
            style={{ 
              background: `linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)`,
              boxShadow: `inset 0 1px 2px rgba(255,255,255,0.1)`
            }}
          />
        </div>
        
        {/* Book Binding Effect */}
        <div 
          className="absolute top-0 left-0 h-full rounded-l-lg border-r-2"
          style={{ 
            width: `${width / 8}px`,
            background: `linear-gradient(to bottom, ${spineColor}, ${spineColor}dd)`,
            borderColor: `${spineColor}bb`
          }}
        ></div>
        
        {/* Light Reflection on Spine */}
        <div 
          className="absolute top-0 left-0 h-full opacity-30"
          style={{ 
            width: `${width / 16}px`,
            background: `linear-gradient(to bottom, white, transparent)`
          }}
        ></div>
        
        {/* Book Thickness */}
        <div 
          className="absolute top-0 left-0 h-full rounded-l-lg"
          style={{ 
            width: `${width / 8}px`,
            background: `linear-gradient(to bottom, ${coverColor}, ${coverColor}dd)`
          }}
        ></div>
        
        {/* Overall Book Shadow */}
        <div 
          className="absolute -bottom-2 left-0 w-full h-4 rounded-lg opacity-30"
          style={{ 
            background: `linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)`,
            filter: 'blur(4px)',
            transform: 'scale(0.95)'
          }}
        ></div>
        
        {/* Book Volume Shadow */}
        <div 
          className="absolute top-0 -right-1 w-2 h-full rounded-r-lg opacity-20"
          style={{ 
            background: `linear-gradient(to right, rgba(0,0,0,0.2), transparent)`
          }}
        ></div>
        
        {/* Final Highlight */}
        <div 
          className="absolute top-0 left-0 w-full h-1 rounded-t-lg opacity-20"
          style={{ 
            background: `linear-gradient(to right, rgba(255,255,255,0.3), transparent)`
          }}
        ></div>
    </div>
  );
};

export default DynamicBookTemplate;