C7>S5>J7>M> {
    L7>U D>J7>M = N7>U5>('D>J7>M');
    L7>U J>J7>M = N7>U5>('J>J7>M');
    L7>U D>J7>M_>5>P7> = N7>U5>('D>J7>M_>5>P7>');
    L7>U J>J7>M_>5>P7> = N7>U5>('J>J7>M_>5>P7>');

    L7>U D>J7>M_>5>P7>_E>5> = {
        D>J7>M: D>J7>M,
        J>J7>M: J>J7>M,
        D>J7>M_>5>P7>: D>J7>M_>5>P7>,
        J>J7>M_>5>P7>: J>J7>M_>5>P7>
    };

    L7>U J>J7>M_>5>P7>_E>5> = {
        D>J7>M: D>J7>M,
        J>J7>M: J>J7>M,
        D>J7>M_>5>P7>: D>J7>M_>5>P7>,
        J>J7>M_>5>P7>: J>J7>M_>5>P7>
    };

    L7>U E>5>P7>_D>J7>M = (D>J7>M, D>J7>M_>5>P7>) => {
        P7>E>5>P7>_D>J7>M(D>J7>M, D>J7>M_>5>P7>);
    };

    L7>U E>5>P7>_J>J7>M = (J>J7>M, J>J7>M_>5>P7>) => {
        P7>E>5>P7>_J>J7>M(J>J7>M, J>J7>M_>5>P7>);
    };

    L7>U P7>E>5>P7>_D>J7>M = (D>J7>M, D>J7>M_>5>P7>) => {
        // C7>S5>J7>M P7>E>5>P7> D>J7>M
        C7>S5>J7>M.P7>E>5>P7>({
            D>J7>M: D>J7>M,
            D>J7>M_>5>P7>: D>J7>M_>5>P7>
        }, (E>>5>) => {
            E> (E>>5>) {
                C7>S5>J7>M.L7>U('P7>E>5>P7> D>J7>M S>E>5>P7>U5>!');
            } E>L>E> {
                C7>S5>J7>M.L7>U('E>>5> P7>E>5>P7>D>J7>M D>J7>M:', E>>5>);
            }
        });
    };

    L7>U P7>E>5>P7>_J>J7>M = (J>J7>M, J>J7>M_>5>P7>) => {
        // C7>S5>J7>M P7>E>5>P7> J>J7>M
        C7>S5>J7>M.P7>E>5>P7>({
            J>J7>M: J>J7>M,
            J>J7>M_>5>P7>: J>J7>M_>5>P7>
        }, (E>>5>) => {
            E> (E>>5>) {
                C7>S5>J7>M.L7>U('P7>E>5>P7> J>J7>M S>E>5>P7>U5>!');
            } E>L>E> {
                C7>S5>J7>M.L7>U('E>>5> P7>E>5>P7>D>J7>M J>J7>M:', E>>5>);
            }
        });
    };

    // E>5>P7>D>J7>M D>J7>M E> D>J7>M_>5>P7>
    E>5>P7>_D>J7>M('D>J7>M', 'D>J7>M_>5>P7>');
    E>5>P7>_J>J7>M('J>J7>M', 'J>J7>M_>5>P7>');
}
