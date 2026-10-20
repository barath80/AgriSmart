import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Linking, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { farmingCourses, Course, CourseModule, QuizQuestion } from '../data/farmingCourses';

interface CourseProgress {
  [courseId: string]: {
    completedModules: string[];
    quizScore?: number;
    completed: boolean;
  };
}

export default function LearnFarmerCourseScreen() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({});
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [progress, setProgress] = useState<CourseProgress>({});
  const [videoVisible, setVideoVisible] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    // Load progress from storage (you can use AsyncStorage for persistence)
    // For now, we'll use state
  }, []);

  const getCourseProgress = (courseId: string) => {
    const courseProgress = progress[courseId] || { completedModules: [], completed: false };
    const totalModules = farmingCourses.find(c => c.id === courseId)?.modules.length || 0;
    const completedCount = courseProgress.completedModules.length;
    const percentage = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
    return { ...courseProgress, percentage };
  };

  const markModuleComplete = (courseId: string, moduleId: string) => {
    setProgress(prev => {
      const courseProgress = prev[courseId] || { completedModules: [], completed: false };
      if (!courseProgress.completedModules.includes(moduleId)) {
        const newCompletedModules = [...courseProgress.completedModules, moduleId];
        const course = farmingCourses.find(c => c.id === courseId);
        const allModulesCompleted = course && newCompletedModules.length === course.modules.length;
        return {
          ...prev,
          [courseId]: {
            ...courseProgress,
            completedModules: newCompletedModules,
            completed: allModulesCompleted || false,
          },
        };
      }
      return prev;
    });
  };

  const handleModuleClick = (course: Course, module: CourseModule) => {
    setSelectedModule(module);
    setSelectedCourse(course);
    // Reset video visibility when opening a new module
    if (module.type === 'lesson' && module.videoUrl) {
      setVideoVisible(prev => ({ ...prev, [module.id]: false }));
    }
    if (module.type === 'quiz') {
      setQuizStarted(false);
      setQuizCompleted(false);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setQuizScore(0);
    }
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizScore(0);
    setQuizCompleted(false);
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleQuizSubmit = () => {
    if (!selectedModule?.quizQuestions) return;

    let score = 0;
    selectedModule.quizQuestions.forEach((question) => {
      if (selectedAnswers[question.id] === question.correctAnswer) {
        score++;
      }
    });

    const totalQuestions = selectedModule.quizQuestions.length;
    const percentage = Math.round((score / totalQuestions) * 100);
    setQuizScore(percentage);
    setQuizCompleted(true);

    // Mark quiz module as complete
    if (selectedCourse) {
      markModuleComplete(selectedCourse.id, selectedModule.id);
      
      // Update quiz score in progress
      setProgress(prev => ({
        ...prev,
        [selectedCourse.id]: {
          ...(prev[selectedCourse.id] || { completedModules: [] }),
          quizScore: percentage,
        },
      }));
    }

    Alert.alert(
      'Quiz Completed!',
      `You scored ${score}/${totalQuestions} (${percentage}%)`,
      [{ text: 'OK' }]
    );
  };

  const handleNextQuestion = () => {
    if (!selectedModule?.quizQuestions) return;
    if (currentQuestionIndex < selectedModule.quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleQuizSubmit();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const closeModule = () => {
    setSelectedModule(null);
    setSelectedCourse(null);
    setQuizStarted(false);
    setQuizCompleted(false);
  };

  const renderCourseCard = (course: Course) => {
    const courseProgress = getCourseProgress(course.id);
    const isCompleted = courseProgress.completed;

    return (
      <TouchableOpacity
        key={course.id}
        style={styles.courseCard}
        onPress={() => setSelectedCourse(course)}
        activeOpacity={0.7}
      >
        <View style={[styles.courseIconContainer, { backgroundColor: `${course.color}20` }]}>
          <Ionicons name={course.icon as any} size={32} color={course.color} />
        </View>
        <View style={styles.courseContent}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseDescription} numberOfLines={2}>
            {course.description}
          </Text>
          <View style={styles.courseMeta}>
            <View style={styles.courseMetaItem}>
              <Ionicons name="time-outline" size={14} color="#9aa9b8" />
              <Text style={styles.courseMetaText}>{course.duration}</Text>
            </View>
            <View style={styles.courseMetaItem}>
              <Ionicons name="library-outline" size={14} color="#9aa9b8" />
              <Text style={styles.courseMetaText}>{course.modules.length} Modules</Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${courseProgress.percentage}%`, backgroundColor: course.color },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {courseProgress.percentage}% Complete
            </Text>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.completedText}>100% Completed</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModuleView = () => {
    if (!selectedCourse || !selectedModule) return null;

    if (selectedModule.type === 'quiz' && !quizStarted && !quizCompleted) {
      return (
        <View style={styles.moduleContainer}>
          <View style={styles.moduleHeader}>
            <TouchableOpacity onPress={closeModule} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#E6F7FF" />
            </TouchableOpacity>
            <Text style={styles.moduleTitle}>{selectedModule.title}</Text>
          </View>
          <ScrollView style={styles.quizIntroContainer}>
            <View style={styles.quizIntroCard}>
              <Ionicons name="help-circle" size={48} color={selectedCourse.color} />
              <Text style={styles.quizIntroTitle}>Quiz Instructions</Text>
              <Text style={styles.quizIntroText}>
                This quiz contains {selectedModule.quizQuestions?.length} multiple-choice questions.
                Read each question carefully and select the best answer.
              </Text>
              <Text style={styles.quizIntroText}>
                You need to answer all questions to complete the quiz.
              </Text>
              <TouchableOpacity
                style={[styles.startQuizButton, { backgroundColor: selectedCourse.color }]}
                onPress={handleStartQuiz}
              >
                <Text style={styles.startQuizButtonText}>Start Quiz</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (selectedModule.type === 'quiz' && quizStarted && !quizCompleted) {
      const currentQuestion = selectedModule.quizQuestions?.[currentQuestionIndex];
      if (!currentQuestion) return null;

      const isLastQuestion = currentQuestionIndex === (selectedModule.quizQuestions?.length || 0) - 1;
      const selectedAnswer = selectedAnswers[currentQuestion.id];

      return (
        <View style={styles.moduleContainer}>
          <View style={styles.moduleHeader}>
            <TouchableOpacity onPress={closeModule} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#E6F7FF" />
            </TouchableOpacity>
            <Text style={styles.moduleTitle}>
              Question {currentQuestionIndex + 1} of {selectedModule.quizQuestions?.length}
            </Text>
          </View>
          <ScrollView style={styles.quizContainer}>
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{currentQuestion.question}</Text>
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      selectedAnswer === index && styles.optionButtonSelected,
                    ]}
                    onPress={() => handleAnswerSelect(currentQuestion.id, index)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.optionRadio,
                        selectedAnswer === index && {
                          backgroundColor: selectedCourse.color,
                          borderColor: selectedCourse.color,
                        },
                      ]}
                    >
                      {selectedAnswer === index && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        selectedAnswer === index && styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.quizNavigation}>
                {currentQuestionIndex > 0 && (
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={handlePreviousQuestion}
                  >
                    <Ionicons name="chevron-back" size={20} color="#E6F7FF" />
                    <Text style={styles.navButtonText}>Previous</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: selectedCourse.color }]}
                  onPress={handleNextQuestion}
                  disabled={selectedAnswer === undefined}
                >
                  <Text style={styles.navButtonText}>
                    {isLastQuestion ? 'Submit Quiz' : 'Next'}
                  </Text>
                  {!isLastQuestion && <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (selectedModule.type === 'quiz' && quizCompleted) {
      return (
        <View style={styles.moduleContainer}>
          <View style={styles.moduleHeader}>
            <TouchableOpacity onPress={closeModule} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#E6F7FF" />
            </TouchableOpacity>
            <Text style={styles.moduleTitle}>Quiz Results</Text>
          </View>
          <ScrollView style={styles.quizResultsContainer}>
            <View style={styles.quizResultsCard}>
              <View style={[styles.scoreCircle, { borderColor: selectedCourse.color }]}>
                <Text style={[styles.scoreText, { color: selectedCourse.color }]}>
                  {quizScore}%
                </Text>
              </View>
              <Text style={styles.resultsTitle}>
                {quizScore >= 70 ? 'Excellent!' : quizScore >= 50 ? 'Good Job!' : 'Keep Learning!'}
              </Text>
              <Text style={styles.resultsDescription}>
                You scored {quizScore}% on this quiz.
              </Text>
              {selectedModule.quizQuestions?.map((question, index) => {
                const userAnswer = selectedAnswers[question.id];
                const isCorrect = userAnswer === question.correctAnswer;
                return (
                  <View key={question.id} style={styles.questionReview}>
                    <View style={styles.questionReviewHeader}>
                      <Text style={styles.questionReviewNumber}>Q{index + 1}</Text>
                      {isCorrect ? (
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                      ) : (
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      )}
                    </View>
                    <Text style={styles.questionReviewText}>{question.question}</Text>
                    <Text style={styles.questionReviewAnswer}>
                      Your Answer: {question.options[userAnswer] || 'Not answered'}
                    </Text>
                    {!isCorrect && (
                      <Text style={styles.questionReviewCorrect}>
                        Correct Answer: {question.options[question.correctAnswer]}
                      </Text>
                    )}
                    <Text style={styles.questionReviewExplanation}>
                      {question.explanation}
                    </Text>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.closeModuleButton, { backgroundColor: selectedCourse.color }]}
                onPress={closeModule}
              >
                <Text style={styles.closeModuleButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    // Convert YouTube URL to embed URL (iframe format)
    const getYouTubeEmbedUrl = (url: string): string | null => {
      if (!url) return null;
      
      // Extract video ID from various YouTube URL formats
      let videoId: string | null = null;
      
      // Handle youtu.be format: https://youtu.be/VIDEO_ID?si=...
      const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (youtuBeMatch) {
        videoId = youtuBeMatch[1];
      }
      
      // Handle youtube.com/watch format: https://www.youtube.com/watch?v=VIDEO_ID
      const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
      if (watchMatch) {
        videoId = watchMatch[1];
      }
      
      // Handle youtube.com/embed format (already an embed URL)
      if (url.includes('youtube.com/embed/')) {
        return url;
      }
      
      // Handle short format: https://www.youtube.com/shorts/VIDEO_ID
      const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) {
        videoId = shortsMatch[1];
      }
      
      if (videoId) {
        // Return embed URL for iframe
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`;
      }
      
      return null;
    };

    return (
      <View style={styles.moduleContainer}>
        <View style={styles.moduleHeader}>
          <TouchableOpacity onPress={closeModule} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#E6F7FF" />
          </TouchableOpacity>
          <Text style={styles.moduleTitle}>{selectedModule.title}</Text>
        </View>
        <ScrollView style={styles.lessonContainer}>
          <View style={styles.lessonContent}>
            {selectedModule.videoUrl && (() => {
              const moduleId = selectedModule.id;
              const isVideoVisible = videoVisible[moduleId] || false;
              const embedUrl = getYouTubeEmbedUrl(selectedModule.videoUrl);
              
              if (!embedUrl) {
                return (
                  <View style={styles.videoErrorContainer}>
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                    <Text style={styles.videoErrorText}>Invalid YouTube URL</Text>
                  </View>
                );
              }
              
              // Show image thumbnail if video is not visible
              if (!isVideoVisible) {
                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setVideoVisible(prev => ({ ...prev, [moduleId]: true }));
                    }}
                    style={styles.videoThumbnailContainer}
                  >
                    <Image
                      source={{ uri: selectedModule.imageUrl || 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80' }}
                      style={styles.videoThumbnailImage}
                      resizeMode="cover"
                    />
                    <View style={styles.videoPlayButtonOverlay}>
                      <View style={styles.videoPlayButton}>
                        <Ionicons name="play-circle" size={64} color="#FFFFFF" />
                      </View>
                      <Text style={styles.videoPlayText}>Tap to play video</Text>
                    </View>
                  </TouchableOpacity>
                );
              }
              
              // Show video iframe when clicked
              return (
                <View style={styles.videoContainer}>
                  <TouchableOpacity
                    style={styles.videoCloseButton}
                    onPress={() => {
                      setVideoVisible(prev => ({ ...prev, [moduleId]: false }));
                    }}
                  >
                    <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <WebView
                    source={{ uri: embedUrl }}
                    style={styles.videoWebView}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsFullscreenVideo={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    startInLoadingState={true}
                    scalesPageToFit={true}
                    allowsProtectedMedia={true}
                    mixedContentMode="always"
                    renderLoading={() => (
                      <View style={styles.videoLoadingContainer}>
                        <Text style={styles.videoLoadingText}>Loading YouTube video...</Text>
                      </View>
                    )}
                    onError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.warn('WebView error: ', nativeEvent);
                    }}
                  />
                </View>
              );
            })()}
            {selectedModule.imageUrl && !selectedModule.videoUrl && (
              <Image
                source={{ uri: selectedModule.imageUrl }}
                style={styles.videoThumbnail}
                resizeMode="cover"
              />
            )}
            {selectedModule.content.map((paragraph, index) => (
              <Text key={index} style={styles.lessonText}>
                {paragraph}
              </Text>
            ))}
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: selectedCourse.color }]}
              onPress={() => {
                if (selectedCourse) {
                  markModuleComplete(selectedCourse.id, selectedModule.id);
                  Alert.alert('Module Completed!', 'Great job completing this module.', [
                    { text: 'OK', onPress: closeModule },
                  ]);
                }
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Mark as Complete</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCourseDetail = () => {
    if (!selectedCourse) return null;

    const courseProgress = getCourseProgress(selectedCourse.id);

    return (
      <View style={styles.courseDetailContainer}>
        <View style={styles.courseDetailHeader}>
          <TouchableOpacity onPress={() => setSelectedCourse(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#E6F7FF" />
          </TouchableOpacity>
          <View style={[styles.courseDetailIcon, { backgroundColor: `${selectedCourse.color}20` }]}>
            <Ionicons name={selectedCourse.icon as any} size={32} color={selectedCourse.color} />
          </View>
          <View style={styles.courseDetailInfo}>
            <Text style={styles.courseDetailTitle}>{selectedCourse.title}</Text>
            <Text style={styles.courseDetailDescription}>{selectedCourse.description}</Text>
            <View style={styles.courseDetailMeta}>
              <View style={styles.courseDetailMetaItem}>
                <Ionicons name="time-outline" size={16} color="#9aa9b8" />
                <Text style={styles.courseDetailMetaText}>{selectedCourse.duration}</Text>
              </View>
              <View style={styles.courseDetailMetaItem}>
                <Ionicons name="library-outline" size={16} color="#9aa9b8" />
                <Text style={styles.courseDetailMetaText}>{selectedCourse.modules.length} Modules</Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${courseProgress.percentage}%`, backgroundColor: selectedCourse.color },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {courseProgress.percentage}% Complete
              </Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.modulesList}>
          {selectedCourse.modules.map((module, index) => {
            const isCompleted = courseProgress.completedModules.includes(module.id);
            return (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleItem}
                onPress={() => handleModuleClick(selectedCourse, module)}
                activeOpacity={0.7}
              >
                <View style={styles.moduleItemLeft}>
                  <View
                    style={[
                      styles.moduleNumber,
                      isCompleted && { backgroundColor: selectedCourse.color },
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.moduleNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.moduleItemContent}>
                    <Text style={styles.moduleItemTitle}>{module.title}</Text>
                    <Text style={styles.moduleItemType}>
                      {module.type === 'quiz' ? 'Quiz' : 'Lesson'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9aa9b8" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {selectedModule ? (
        renderModuleView()
      ) : selectedCourse ? (
        renderCourseDetail()
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="school-outline" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Learn Farmer Course</Text>
            <Text style={styles.subtitle}>Enhance your farming knowledge</Text>
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={styles.coursesList}>
              {farmingCourses.map(course => renderCourseCard(course))}
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    padding: 24,
    paddingTop: 32,
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  coursesList: {
    gap: 16,
  },
  courseCard: {
    backgroundColor: '#071837',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  courseIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  courseContent: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 6,
  },
  courseDescription: {
    fontSize: 14,
    color: '#9aa9b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  courseMeta: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  courseMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  courseMetaText: {
    fontSize: 12,
    color: '#9aa9b8',
    marginLeft: 6,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#9aa9b8',
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '700',
    marginLeft: 4,
  },
  courseDetailContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  courseDetailHeader: {
    backgroundColor: '#071837',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    marginBottom: 16,
  },
  courseDetailIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  courseDetailInfo: {
    flex: 1,
  },
  courseDetailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 8,
  },
  courseDetailDescription: {
    fontSize: 14,
    color: '#9aa9b8',
    marginBottom: 16,
    lineHeight: 20,
  },
  courseDetailMeta: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  courseDetailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  courseDetailMetaText: {
    fontSize: 14,
    color: '#9aa9b8',
    marginLeft: 6,
  },
  modulesList: {
    flex: 1,
    padding: 16,
  },
  moduleItem: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  moduleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  moduleNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E6F7FF',
  },
  moduleItemContent: {
    flex: 1,
  },
  moduleItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6F7FF',
    marginBottom: 4,
  },
  moduleItemType: {
    fontSize: 12,
    color: '#9aa9b8',
  },
  moduleContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  moduleHeader: {
    backgroundColor: '#071837',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeButton: {
    marginRight: 16,
  },
  moduleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6F7FF',
    flex: 1,
  },
  lessonContainer: {
    flex: 1,
    padding: 16,
  },
  lessonContent: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  lessonText: {
    fontSize: 15,
    color: '#E6F7FF',
    lineHeight: 24,
    marginBottom: 16,
  },
  videoContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b2433',
    borderWidth: 1,
    borderColor: '#1e293b',
    height: 220,
    width: '100%',
  },
  videoWebView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b2433',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLoadingText: {
    color: '#9aa9b8',
    fontSize: 14,
    fontWeight: '500',
  },
  videoErrorContainer: {
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  videoErrorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 20,
  },
  videoThumbnailContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#0b2433',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  videoThumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
  },
  videoPlayButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  videoPlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  videoCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  quizIntroContainer: {
    flex: 1,
    padding: 16,
  },
  quizIntroCard: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quizIntroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E6F7FF',
    marginTop: 16,
    marginBottom: 12,
  },
  quizIntroText: {
    fontSize: 15,
    color: '#9aa9b8',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  startQuizButton: {
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  startQuizButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quizContainer: {
    flex: 1,
    padding: 16,
  },
  questionCard: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6F7FF',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0b2433',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  optionButtonSelected: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9aa9b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    fontSize: 15,
    color: '#E6F7FF',
    flex: 1,
    lineHeight: 22,
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quizNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#22c55e',
  },
  navButtonText: {
    color: '#E6F7FF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  quizResultsContainer: {
    flex: 1,
    padding: 16,
  },
  quizResultsCard: {
    backgroundColor: '#071837',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '800',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E6F7FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultsDescription: {
    fontSize: 16,
    color: '#9aa9b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  questionReview: {
    backgroundColor: '#0b2433',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  questionReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  questionReviewNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E6F7FF',
  },
  questionReviewText: {
    fontSize: 15,
    color: '#E6F7FF',
    marginBottom: 12,
    lineHeight: 22,
  },
  questionReviewAnswer: {
    fontSize: 14,
    color: '#9aa9b8',
    marginBottom: 6,
  },
  questionReviewCorrect: {
    fontSize: 14,
    color: '#22c55e',
    marginBottom: 8,
    fontWeight: '600',
  },
  questionReviewExplanation: {
    fontSize: 13,
    color: '#9aa9b8',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  closeModuleButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeModuleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
