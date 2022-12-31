mergeInto(LibraryManager.library, {
 
    InitJs: function() {
        console.log(unityFramework);
        if(typeof window != "undefined"){
            window.arrayToReturnPtr = function (arr, type) {
                var buf = (new type(arr)).buffer;
                var ui8a = new Uint8Array(buf);
                var ptr = _malloc(ui8a.byteLength + 4);
                HEAP32.set([arr.length], ptr >> 2);
                HEAPU8.set(ui8a, ptr + 4);
                return ptr;
            }
        }
    },
    NotifyStart : function () {

        if(typeof window != "undefined"){

            window.startRecord();

        }
    },

    NotifyEnd : function () {

        if(typeof window != "undefined"){

            window.stopRecord();

        }
    }
 
});
