// 生成评估音频文件的脚本
const fs = require('fs')
const path = require('path')

// 导入 TTS 服务
async function generateAssessmentAudio() {
  console.log('🎵 开始生成评估音频文件...')
  
  const audios = [
    {
      id: 1,
      filename: 'test-1-level6.wav',
      text: `Good morning! How much are these apples? They are three dollars per kilogram. Very fresh and sweet. That sounds good. Can I have two kilograms please? Of course. Anything else you need today? Yes, I also need some bananas. How much are they? The bananas are two dollars per kilogram. They are very ripe and perfect for eating. Great! I'll take one kilogram of bananas too. So that's two kilograms of apples and one kilogram of bananas. The total is eight dollars. Here you go. Thank you very much! Thank you for shopping with us. Have a wonderful day!`
    },
    {
      id: 2,
      filename: 'test-2-level12.wav',
      text: `Hey Sarah, how are you finding your first semester at university? It's been quite an adjustment, to be honest. The workload is much heavier than I expected. I know what you mean. When I started, I struggled with time management too. Have you joined any clubs or societies yet? I've been thinking about it. I'm interested in the debate society, but I'm worried it might take up too much time. Actually, extracurricular activities can be really helpful. They're a great way to meet people and develop skills that complement your studies. That's a good point. I've also been considering getting a part-time job to help with expenses. That could work, but make sure you don't overcommit yourself. Your studies should remain the priority, especially in your first year. You're right. I think I'll start with one activity and see how I manage before taking on more responsibilities.`
    },
    {
      id: 3,
      filename: 'test-3-level18.wav',
      text: `Good afternoon, thank you for coming in today. Could you start by telling me about your professional background and what attracted you to this position? Certainly. I have five years of experience in digital marketing, specializing in content strategy and social media management. I've successfully led campaigns that increased brand engagement by over 200% at my current company. What particularly appeals to me about this role is the opportunity to work with innovative technologies and contribute to a forward-thinking organization that values creativity and data-driven decision making. That's impressive. Can you describe a challenging project you've managed and how you overcame the obstacles you encountered? Last year, we faced a significant challenge when a major product launch campaign wasn't performing as expected. The engagement rates were below our projections, and we had a tight deadline to turn things around. I analyzed the data thoroughly, identified that our target demographic was responding better to video content than static images, and quickly pivoted our strategy. We reallocated budget, collaborated with the creative team to produce compelling video content, and ultimately exceeded our original targets by 150%. Excellent problem-solving skills. How do you stay current with the rapidly evolving digital marketing landscape?`
    },
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
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (const audio of audios) {
    console.log(`\n📝 正在生成音频 ${audio.id}: ${audio.filename}`)
    console.log(`📄 文本长度: ${audio.text.length} 字符`)
    
    try {
      // 调用 TTS API
      const response = await fetch('http://localhost:3003/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: audio.text,
          voice: 'ef_dora', // 使用英语女声
          speed: getSpeedForLevel(audio.id)
        })
      })

      if (!response.ok) {
        throw new Error(`TTS API 调用失败: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.audioUrl) {
        // 复制生成的音频文件到评估音频目录
        const sourcePath = path.join(__dirname, '..', 'public', result.audioUrl.replace('/public/', ''))
        const targetPath = path.join(outputDir, audio.filename)
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`✅ 音频文件已生成: ${audio.filename}`)
          
          // 删除原始文件
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
    
    // 等待一秒避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n🎉 评估音频生成完成!')
}

// 根据难度等级设置语速
function getSpeedForLevel(audioId) {
  const speedMap = {
    1: 0.8,  // 很慢
    2: 0.9,  // 慢
    3: 1.0,  // 正常
    4: 1.1,  // 快
    5: 1.2   // 很快
  }
  return speedMap[audioId] || 1.0
}

// 检查是否直接运行此脚本
if (require.main === module) {
  generateAssessmentAudio().catch(console.error)
}

module.exports = { generateAssessmentAudio }