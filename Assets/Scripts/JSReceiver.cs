using System;
using System.Runtime.InteropServices;
using UnityEngine;
using Cysharp.Threading.Tasks;
using UnityEngine.Playables;
using VRM;

public class JSReceiver : MonoBehaviour
{
    [SerializeField] private PlayableDirector _director;
    [SerializeField] private GameObject _trigger;
    // Start is called before the first frame update
    void Start()
    {
        try
        {
            InitJs();
        }
        catch
        {
            
        }
    }

    private bool LastState = false;
    private bool Started = false;
    // Update is called once per frame
    void Update()
    {
        if (!Started) return;

        if (LastState && !_trigger.activeSelf)
        {
            NotifyEnd();
        }

        LastState = _trigger.activeSelf;

    }
    
    
    [DllImport("__Internal")]
    private static extern void NotifyStart();
    
    [DllImport("__Internal")]
    private static extern void NotifyEnd();
    
    [DllImport("__Internal")]
    private static extern void InitJs();

    private static byte[] ptrToByteArray(int addr)
    {
        var ptr = new IntPtr(addr);
        var len = Marshal.ReadInt32(ptr);
        var arr = new byte[len];
        Marshal.Copy(IntPtr.Add(ptr, 4), arr, 0, len);
        return arr;
    }

    public void ReadVRMData(int ptr)
    {
        var ary = ptrToByteArray(ptr);
        LoadAndShowAvatar(ary).Forget();
    }

    private async UniTask LoadAndShowAvatar(byte[] bytes)
    {
        await UniTask.SwitchToMainThread();

        var context = new VRMImporterContext();
        context.ParseGlb(bytes);
        Debug.Log("parse ok");

        var meta = context.ReadMeta(false); //引数をTrueに変えるとサムネイルも読み込みます

        //同期処理で読み込みます
        context.Load();
        Debug.Log("loaded");

        //読込が完了するとcontext.RootにモデルのGameObjectが入っています
        var root = context.Root;
        //モデルをワールド上に配置します
        root.transform.SetParent(transform.parent, false);
        //メッシュを表示します
        context.ShowMeshes();

        setTimeline(root);
        
        
        
        // 音ズレ対策
        
        GC.Collect();
        _director.Play();
        await UniTask.Yield();
        _director.Pause();
        await UniTask.Delay(TimeSpan.FromSeconds(2));
        _director.Resume();

        Started = true;
        NotifyStart();

    }

    public void setTimeline(GameObject avatar)
    {
        var bindings = _director.playableAsset.outputs;
        foreach (var playableBinding in bindings)
        {
            if(playableBinding.streamName.IndexOf("bs") == 0)
            {
                //Blend Shape
                _director.SetGenericBinding(playableBinding.sourceObject,avatar.GetComponent<VRMBlendShapeProxy>());

            }

            if (playableBinding.streamName.IndexOf("anim") == 0)
            {
                _director.SetGenericBinding(playableBinding.sourceObject,avatar.GetComponent<Animator>());
            }
            
        }
    }

}
