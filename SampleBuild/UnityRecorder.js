/*

The MIT License (MIT)
Copyright © 2023 wakapippi

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


// 定義されている場合、mp4に変換することを試みる。
let outputContainer = "mp4";



function setStateToSelectModel() {

    // Unityの読み込みが終わり、モデルの選択が可能になった時の処理

    document.querySelector("#status").innerHTML = "モデル選択待ち";
    document.querySelector("#information").innerHTML = "準備完了。VRMモデルを選択してショート動画を生成できます。";
    document.querySelector("#loading").style.display = "none";
    document.querySelector("#button").style = "display:initial!important";

}

function setStateToFinish() {

    // ダウンロードが完了したときに行う処理

    document.querySelector("#status").innerHTML = "生成完了！"
    document.querySelector("#information").innerHTML = "生成が完了しました。ダウンロードされた動画をご確認ください";
    document.querySelector("#loading").style.display = "none";

}



function setStateToWaitFFmpeg() {

}



function setStateToLoadAvatar() {

    // アバター読み込み中

    document.querySelector("#status").innerHTML = "アバター読み込み中"
    document.querySelector("#information").innerHTML = "データを読み込んでいます。しばらくお待ちください";
    document.querySelector("#loading").style.display = "";
    document.querySelector("#button").style = "display:none!important";
}

function setStateToLoadRecording() {

    // 動画生成中

    document.querySelector("#status").innerHTML = "ショート動画生成中"
    document.querySelector("#information").innerHTML = "動画を生成しています。このウィンドウを閉じたり、バックグラウンドにしないでください。";
    document.querySelector("#loading").style.display = "";
}



// MediaStreamDestinationNode
let msDist = null;

// 録画対象のMediaStream (音声＋映像)
let recordStream = null;

// 録画用のMediaRecorder
let recorder = null;

// FFmpegによるwebmコンテナからmp4コンテナの変換が可能かどうか。VP8のみ対応のブラウザではエンコードが発生しいて恐ろしく時間がかかるので許可しない。
let isConvertOk = false;

// AudioContextのコンストラクタを細工する
let auc = AudioContext;
AudioContext = function () {

    let acontext = new auc(arguments);

    msDist = acontext.createMediaStreamDestination();

    let videoStream = canvas.captureStream(30);

    recordStream = new MediaStream();

    for (const iterator of videoStream.getVideoTracks()) {
        recordStream.addTrack(iterator);
    }

    let audioStream = msDist.stream;
    for (const iterator of audioStream.getAudioTracks()) {
        recordStream.addTrack(iterator);
    }

    console.log("hijacked audio");
    return acontext;
}


// AudioNodeのconnectを細工し、音がスピーカーから出ずに録音用のMediaStreamDestinationNodeにつながるようにする
let oldConnect = AudioNode.prototype.connect;
AudioNode.prototype.connect = function (...args) {

    // Destinationノードにconnectする場合のみ横取りする
    if (args[0].constructor.name == "AudioDestinationNode") {

        this.connect(msDist);
        console.log("connected to MediaStreamDestinationNode")

        return;

    }
    oldConnect.apply(this, arguments);

}


function handleFile() {


    let file = document.querySelector('#file').files[0];
    let fileReader = new FileReader();
    fileReader.onload = function (evt) {

        setStateToLoadAvatar();

        let buffer = evt.target.result;
        let uint8Array = new Uint8Array(buffer);

        // arrayToReturnPtrはjslib側で定義している
        let ptr = arrayToReturnPtr(uint8Array, Uint8Array);
        unityInstance.SendMessage("JSReceiver", "ReadVRMData", ptr);
    };
    fileReader.readAsArrayBuffer(file);

}

let extension = "webm";

// jslib側に向けて公開
window.startRecord = function () {

    setStateToLoadRecording();

    if (!msDist) {
        alert("エラー");
        return;
    }
    const stream = canvas.captureStream(60);
    let audioStream = msDist.stream;
    for (const iterator of audioStream.getAudioTracks()) {
        stream.addTrack(iterator);
    }

    if (MediaRecorder.isTypeSupported("video/mp4")) {

        // mp4出力をするときに変換が不要, Safari
        extension = "mp4";
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=H264' });
        isConvertOk = false;

    }
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=H264")) {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=H264' });
        isConvertOk = true;
    }
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=VP8")) {

        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=VP8' });
        isConvertOk = false;

    }
    else {

        recorder = new MediaRecorder(stream);
        isConvertOk = false;

    }

    recorder.start();
    recorder.ondataavailable = async e => {

        window.blob = new Blob([e.data], { type: e.data.type });


        if (typeof outputContainer != "undefined" && outputContainer == "mp4" && isConvertOk && typeof SharedArrayBuffer != "undefined") {

            setStateToWaitFFmpeg();

            try {

                // mp4変換作業
                const { createFFmpeg, fetchFile } = FFmpeg;
                const ffmpeg = createFFmpeg({ log: true });
                await ffmpeg.load();
                const url = window.URL.createObjectURL(blob);
                let ff = await fetchFile(url);
                ffmpeg.FS("writeFile", "test.webm", ff);
                await ffmpeg.run("-i", "test.webm", "-vcodec", "copy", "-acodec", "aac", "out.mp4");
                const data = ffmpeg.FS('readFile', 'out.mp4');

                // ダウンロードさせる
                let down = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }))
                const link = document.createElement("a");
                link.style.display = "none";
                link.href = down;
                link.download = "rec.mp4";
                document.body.appendChild(link);
                link.click();

                setStateToFinish();

                return;
            }

            catch {

                // webmにフォールバックする

            }

        }

        // ダウンロードさせる
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = url;
        link.download = "rec." + extension;
        document.body.appendChild(link);
        link.click();

        setStateToFinish();

    }
}


// jslib側に向けて公開
window.stopRecord = function () {

    recorder.stop();

}
