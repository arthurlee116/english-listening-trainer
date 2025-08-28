// 生成剩余的评估音频文件
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

async function generateRemainingAudio() {
  console.log('🎵 开始生成剩余的评估音频文件...')
  
  const audios = [
    {
      id: 4,
      filename: 'test-4-level24.wav',
      text: `Good evening. In today's technology segment, we're examining the unprecedented developments in artificial intelligence that are reshaping industries worldwide. According to recent research from leading tech institutions, machine learning algorithms are now demonstrating capabilities that were previously thought to be decades away from practical implementation. The breakthrough centers around advanced neural network architectures that can process complex, multi-modal data streams simultaneously, enabling applications ranging from autonomous vehicle navigation to sophisticated medical diagnostics. Industry analysts suggest these innovations could potentially revolutionize sectors including healthcare, transportation, and financial services within the next five years. However, this rapid advancement has also intensified discussions about ethical considerations and regulatory frameworks. Prominent researchers are calling for comprehensive guidelines to ensure responsible development and deployment of these technologies. The debate encompasses concerns about data privacy, algorithmic bias, and the societal implications of increasingly autonomous systems. Major technology corporations have announced substantial investments in AI safety research, while government agencies are establishing specialized committees to address the regulatory challenges posed by these emerging technologies. The intersection of innovation and governance continues to evolve as stakeholders navigate the balance between technological progress and public safety.`
    },
    {
      id: 5,
      filename: 'test-5-level30.wav',
      text: `Today we're examining the epistemological implications of postmodern theoretical frameworks within the context of interdisciplinary research methodologies. The fundamental question we must address concerns the extent to which traditional empirical paradigms remain viable when confronted with increasingly complex, multi-dimensional phenomena that resist conventional analytical categorization. Contemporary scholars argue that the intersection of phenomenological approaches with quantitative methodologies creates a synergistic framework that transcends the limitations inherent in singular methodological perspectives. This synthesis, however, necessitates a reconceptualization of validity constructs and requires researchers to develop sophisticated analytical competencies that accommodate both interpretive and empirical dimensions. The implications extend beyond mere methodological considerations to encompass broader philosophical questions about the nature of knowledge construction itself. When we consider the hermeneutic circle and its relationship to data interpretation, we encounter fundamental tensions between objective measurement and subjective understanding that have profound implications for research validity and generalizability. Furthermore, the emergence of computational methodologies and big data analytics introduces additional complexity to this already multifaceted landscape, challenging traditional notions of research design while simultaneously offering unprecedented opportunities for innovative inquiry that bridges quantitative precision with qualitative depth and contextual sensitivity.`
    }
  ]

  const outputDir = path.join(__dirname, '..', 'public', 'assessment-audio')
  
  for (const audio of audios) {
    console.log(`\n📝 正在生成音频 ${audio.id}: ${audio.filename}`)
    console.log(`📄 文本长度: ${audio.text.length} 字符`)
    
    try {
      const response = await fetch('http://localhost:3003/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: audio.text,
          voice: 'ef_dora',
          speed: getSpeedForLevel(audio.id)
        })
      })

      if (!response.ok) {
        throw new Error(`TTS API 调用失败: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.audioUrl) {
        const sourcePath = path.join(__dirname, '..', 'public', result.audioUrl.replace('/public/', ''))
        const targetPath = path.join(outputDir, audio.filename)
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`✅ 音频文件已生成: ${audio.filename}`)
          fs.unlinkSync(sourcePath)
        } else {
          console.error(`❌ 源音频文件不存在: ${sourcePath}`)
        }
      } else {
        console.error(`❌ TTS 生成失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      console.error(`❌ 生成音频 ${audio.filename} 时出错:`, error.message)
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log('\n🎉 剩余评估音频生成完成!')
}

function getSpeedForLevel(audioId) {
  const speedMap = {
    4: 1.1,  // 快
    5: 1.2   // 很快
  }
  return speedMap[audioId] || 1.0
}

generateRemainingAudio().catch(console.error)