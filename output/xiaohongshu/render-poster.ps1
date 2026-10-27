Add-Type -AssemblyName System.Drawing
$outDir = $PSScriptRoot
$bmp = [System.Drawing.Bitmap]::new(1440,1920)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
function Brush($hex) { [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function Box($x,$y,$w,$h,$c) { $b=Brush $c; $g.FillRectangle($b,$x,$y,$w,$h); $b.Dispose() }
function Txt($s,$x,$y,$size,$color,$bold=$false) {
  $style=[System.Drawing.FontStyle]::Regular
  if($bold){$style=[System.Drawing.FontStyle]::Bold}
  $f=[System.Drawing.Font]::new('Microsoft YaHei',$size,$style,[System.Drawing.GraphicsUnit]::Pixel)
  $b=Brush $color
  $g.DrawString($s,$f,$b,[float]$x,[float]$y,[System.Drawing.StringFormat]::GenericTypographic)
  $f.Dispose(); $b.Dispose()
}
$ink='#17251F'; $muted='#647068'; $orange='#EE613B'; $paper='#F5F2E8'; $green='#DDF079'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml($paper))
Box 76 76 50 50 $ink
Txt 'K' 86 77 37 $green $true
Txt 'KNOWLEDGE QUEST' 145 81 30 $ink $true
Txt '知识征途 / AI 学习工作流' 872 84 25 $muted
Box 80 160 1280 2 '#C9CEC3'
Txt '一个知识分享者的学习工具实践' 80 207 30 $muted
Txt '想入行，' 70 278 112 $ink $true
Txt '先把这个领域' 70 427 112 $ink $true
Box 80 581 618 132 $green
Txt '搞明白。' 83 579 112 $ink $true
Txt '快速了解一个行业 / 一项技术' 82 757 43 $ink $true
Txt '建立认知框架，找到自己的入行起点。' 82 823 34 $muted
Box 80 922 1280 174 '#EAE7DC'
Box 80 922 7 174 $orange
Txt '以前，我在这里分享访谈里的知识。' 113 950 32 $ink
Txt '现在，我把「如何快速了解陌生领域」' 113 998 32 $ink
Txt '做成了一条可以跟着走的学习路径。' 113 1046 32 $ink
Txt '把「我想了解」变成「我知道怎么开始」' 80 1150 41 $ink $true
Txt '08 个学习环节，串起一条入门路线' 82 1216 28 $muted
$xs=@(80,520,960)
$titles=@('看清全貌','找到重点','验证理解')
$subs=@('多视角研究 · 识别分歧','筛选资源 · 拆解学习路径','练习与自测 · 找到薄弱点')
for($i=0;$i -lt 3;$i++) {
  $x=$xs[$i]
  Box $x 1290 400 258 $ink
  Txt ('0'+($i+1)) ($x+27) 1313 30 $green $true
  Txt $titles[$i] ($x+27) 1371 44 '#FFFFFF' $true
  Txt $subs[$i] ($x+27) 1450 24 '#D9E0D4'
}
Txt '你最想了解哪个行业，或学会哪项技术？' 80 1613 40 $ink $true
Txt '在评论区聊聊你的下一个学习主题' 82 1676 30 $muted
Box 80 1760 1280 2 '#C9CEC3'
Txt '设计灵感参考：大刘老师' 80 1790 23 $muted
Txt '《用claude、codex、workbuddy10倍学习任何知识（轻科技）》' 80 1828 23 $muted
$bmp.Save((Join-Path $outDir 'knowledge-quest-xiaohongshu.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
