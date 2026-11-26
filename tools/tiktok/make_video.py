import subprocess, glob, sys
key=sys.argv[1]
import os
OUT=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),"out")
files=sorted(glob.glob(f"{OUT}/{key}/{key}_*.png"))
durs=[2.2]+[4.6]*(len(files)-2)+[4.2]
fade=0.4; fps=30
args=["ffmpeg","-y","-loglevel","error"]
for f in files: args+=["-i",f]
fc=[]
for i,d in enumerate(durs):
    n=int(round((d+fade)*fps))
    fc.append(f"[{i}:v]scale=1188:2112,zoompan=z='1+0.04*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1080x1920:fps={fps},setsar=1,format=yuv420p[v{i}]")
off=0; prev="v0"
for i in range(1,len(files)):
    off+=durs[i-1]
    fc.append(f"[{prev}][v{i}]xfade=transition=fade:duration={fade}:offset={off:.2f}[x{i}]"); prev=f"x{i}"
args+=["-filter_complex",";".join(fc),"-map",f"[{prev}]","-c:v","libx264","-preset","veryfast","-crf","24","-pix_fmt","yuv420p","-movflags","+faststart",f"{OUT}/{key}/{key}_video.mp4"]
subprocess.run(args,check=True)
