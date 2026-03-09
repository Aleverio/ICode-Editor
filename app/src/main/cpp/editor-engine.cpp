#include <jni.h>
#include <string>
#include <vector>
#include <regex>
#include <mutex>
#include <stack>

class TextEngine {
private:
    std::string buffer;
    std::stack<std::string> undoStack;
    std::mutex mtx;

public:
    void update(const std::string& text) {
        std::lock_guard<std::mutex> lock(mtx);
        buffer = text;
    }

    std::string analyze() {
        std::lock_guard<std::mutex> lock(mtx);
        if (buffer.empty()) return "";
        std::string result = "";
        try {
            // Keywords
            std::regex kRegex("\\b(package|import|class|fun|function|var|val|let|const|if|else|for|while|return|private|public|protected|override|internal|object|interface|enum|data|suspend|inline|native|external|try|catch|finally|throw|when|case|default)\\b");
            auto k_begin = std::sregex_iterator(buffer.begin(), buffer.end(), kRegex);
            auto k_end = std::sregex_iterator();
            for (auto i = k_begin; i != k_end; ++i) {
                result += std::to_string(i->position()) + "," + std::to_string(i->position() + i->length()) + ",1;";
            }
            // Strings
            std::regex sRegex("\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'");
            auto s_begin = std::sregex_iterator(buffer.begin(), buffer.end(), sRegex);
            for (auto i = s_begin; i != k_end; ++i) {
                result += std::to_string(i->position()) + "," + std::to_string(i->position() + i->length()) + ",2;";
            }
        } catch (...) { return ""; }
        return result;
    }
};

static TextEngine g_engine;

extern "C" {
JNIEXPORT void JNICALL Java_com_example_icstudioeditor_NativeEngine_updateBuffer(JNIEnv* env, jobject, jstring text) {
    const char* nativeText = env->GetStringUTFChars(text, nullptr);
    if (nativeText) {
        g_engine.update(std::string(nativeText));
        env->ReleaseStringUTFChars(text, nativeText);
    }
}

JNIEXPORT jstring JNICALL Java_com_example_icstudioeditor_NativeEngine_analyzeStyles(JNIEnv* env, jobject, jstring code, jstring language) {
    return env->NewStringUTF(g_engine.analyze().c_str());
}
}
