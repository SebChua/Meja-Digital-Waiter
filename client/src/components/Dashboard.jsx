import React from 'react';
import { Nav, Navbar, Modal, Button, Badge } from 'react-bootstrap';
import { Fab } from 'react-tiny-fab';
import io from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReceipt, faBars, faConciergeBell } from '@fortawesome/free-solid-svg-icons'
import { Menu } from 'src/components/menu/Menu';
import { Payment } from 'src/components/payment/Payment';
import { Checkout } from 'src/components/checkout/Checkout';
import { navigate } from "@reach/router";
import { About } from 'src/components/about/About';
import { Orders } from 'src/components/order/Orders';
import { Reservation } from 'src/components/reservation/Reservation';
import { LoginDialog } from 'src/components/reservation/LoginDialog';
import { NavOverlay } from 'src/components/NavOverlay';
import { Requests } from 'src/utilities/Requests';
import 'src/styles/styles.css';
import 'react-tiny-fab/dist/styles.css';

console.log('React version');
console.log(React.version);

export const cartOps = {
    ADD: 'add',
    DELETE: 'delete',
    UPDATE: 'update'
}

const tabs = {
    ALL: 'all',
    ABOUT: 'about',
    ORDERS: 'orders',
    CHECKOUT: 'checkout',
    RESERVATION: 'reservation',
    PAYMENT: 'payment'
}

export const orderStatus = {
    ORDERED: 'Ordered',
    PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
}

export class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showOverlay: false,
            showCheckout: false,
            activeTab: tabs.ALL,
            orderList: [],
            cart: new Map(),
            showLoginDialog: false,
            showCompleteOrderWarning: false,
            reservation: {},
            callingWaiter: false,
            showConfirmCallWaiter: false
        };
        this.socket = io.connect('http://127.0.0.1:5000/');
    }


    componentDidMount() {
        this.getOrderList().then(orderList => {
            this.setState({ orderList: orderList })
        });

        this.setupSockets();
    }

    getOrderList = async () => {
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            return [];
        }
        const session = await Requests.getSession(localStorage.getItem('sessionId'));
        return session ? session.order_list : [];
    }


    setupSockets = () => {
        this.socket.on('updateOrders', async (order) => {
            // Update the status of the order that has been changed
            try {
                console.log('Order has been updated');
                console.log(await this.getOrderList());
                this.setState({
                    orderList: await this.getOrderList()
                });
            } catch (err) {
                console.error(err);
            }
        });

        this.socket.on('callWaiterToggled', () => {
            this.handleCallWaiter(false);
        })
    }

    // #region Cart Operations
    itemInCart = (menuItem) => {
        return this.state.cart.has(menuItem._id);
    }

    updateCart = (orderItem, operation) => {
        let oldCart = this.state.cart;
        let newCart = new Map(oldCart);

        switch (operation) {
            case cartOps.ADD || cartOps.UPDATE:
                newCart.set(orderItem.menu_item._id, orderItem);
                break;

            case cartOps.DELETE:
                newCart.delete(orderItem.menu_item._id);
                break;
            default:
                break;
        }

        this.setState({ cart: newCart });
    }

    /* Open when someone clicks on the span element */
    handleOpenCart = () => {
        this.setState({ showCheckout: true });
    }

    /* Close when someone clicks on the "x" symbol inside the overlay */
    handleCloseCart = () => {
        this.setState({ showCheckout: false });
    }
    // #endregion

    showLogin = () => {
        this.setState({ showLoginDialog: true });
    }

    // #region Event Handlers
    handleNavSelect = (event) => {
        if (event === 'logout') {
            localStorage.removeItem('sessionId');
            navigate('/');
        } else {
            this.setState({ activeTab: event });
        }
    }

    handleOrderCart = async () => {
        const order = {
            order_items: [...this.state.cart.values()],
            status: orderStatus.ORDERED
        }

        // Send order to be stored in database
        try {
            // Add given generated order id
            const orderId = await Requests.addOrder(localStorage.getItem('sessionId'), order);
            order['_id'] = orderId;

            // Inform staff of new customer order
            this.socket.emit('customer_order', order);

            // Update order list, empty cart and navigate to order list
            this.setState({
                orderList: await this.getOrderList(),
                cart: new Map(),
                activeTab: tabs.ORDERS,
                showCheckout: false,
            });

        } catch (err) {
            console.error(err);
        }
    }

    handlePayment = () => {
        this.setState({ 
            showCompleteOrderWarning: false,
            activeTab: tabs.PAYMENT 
        });
    }

    handleCloseOrder = () => {
        console.log('Closing Order and Paying');
        console.log(this.state.orderList);

        this.setState({ showCompleteOrderWarning: true });

        // Send entire session info to the backend to be stored in db
    }
    // #endregion

    handleCloseWarning = () => {
        this.setState({ showCompleteOrderWarning: false });
    }
    
    /* Open when someone clicks on the span element */
    handleOpenNav = () => {
        this.setState({ showOverlay: true });
    }

    /* Close when someone clicks on the "x" symbol inside the overlay */
    handleCloseNav = () => {
        this.setState({ showOverlay: false });
    }

    handleCallWaiter = async (confirmedCallWaiter) => {
        let calling = this.state.callingWaiter;
        if (calling || confirmedCallWaiter) {
            const session = await Requests.getSession(localStorage.getItem('sessionId'));
            const tableId = session.table_id;
            
            if (confirmedCallWaiter) {
                // Call a waiter
                this.socket.emit('call_waiter', tableId);
            }
            // Toggle the calling waiter status
            await Requests.toggleCallWaiter(tableId);
            this.setState({ callingWaiter: !calling, showConfirmCallWaiter: false });
        } else {
            // Open modal to make user confirm waiter call
            this.setState({ showConfirmCallWaiter: true });
        }
    }

    closeConfirmCallWaiter = () => {
        this.setState({ showConfirmCallWaiter: false });
    }

    confirmOrderModal = () => (
        <Modal show={this.state.showCompleteOrderWarning} onHide={this.handleCloseWarning}>
            <Modal.Header>
                <Modal.Title>Proceed to Payment</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                Confirm your orders and proceed to payment?
            </Modal.Body>
            <Modal.Footer>
                <Button variant="danger" onClick={this.handleCloseWarning}>
                    Cancel
                </Button>
                <Button variant="success" onClick={this.handlePayment}>
                    Proceed
                </Button>
            </Modal.Footer>
        </Modal>
    )

    confirmWaiterModal = () => (
        <Modal 
            show={this.state.showConfirmCallWaiter} 
            onHide={this.closeConfirmCallWaiter}
            centered
        >
            <Modal.Header>
                <Modal.Title>Need Help?</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                Need assistance from one of our friendly waiting staff?
            </Modal.Body>
            <Modal.Footer>
                <Button variant="success" onClick={() => this.handleCallWaiter(true)}>
                    Call Waiter
                </Button>
            </Modal.Footer>
        </Modal>
    )

    render() {
        const reservationProps = {
            showLogin: this.showLogin,
        }
        return (
            <div>
                <NavOverlay tabs={tabs} show={this.state.showOverlay} onHide={this.handleCloseNav} handleNavSelect={this.handleNavSelect} activeTab={this.state.activeTab} />
                <Checkout
                    cart={this.state.cart}
                    updateCart={this.updateCart}
                    handleOrderCart={this.handleOrderCart}
                    show={this.state.showCheckout}
                    onHide={this.handleCloseCart}

                />
                <Navbar variant="dark" bg="black" sticky="top" onSelect={(tab => this.handleNavSelect(tab))}>
                    <Nav className="mr-auto">
                        <Nav.Item>
                            <Nav.Link onClick={this.handleOpenNav}><FontAwesomeIcon icon={faBars} color="white" /></Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Nav className="mr-auto">
                        <Nav.Item>
                            <Nav.Link eventKey={tabs.ALL}><Navbar.Brand>Méja</Navbar.Brand></Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Nav>
                        <Nav.Item>
                            <Nav.Link onClick={this.handleOpenCart}>
                                <FontAwesomeIcon icon={faReceipt} color="white" />
        {this.state.cart.size > 0 && <Badge pill variant="info">{this.state.cart.size}</Badge>}
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Navbar>

                {this.state.activeTab === tabs.ABOUT ? <About /> : null}
                {this.state.activeTab === tabs.ALL ? <Menu
                    itemInCart={this.itemInCart}
                    updateCart={this.updateCart}
                    display="all"
                /> : null}
                {this.state.activeTab === tabs.ORDERS ? <Orders
                    orderList={this.state.orderList}
                    handleCloseOrder={this.handleCloseOrder}
                /> : null}
                {this.state.activeTab === tabs.RESERVATION ? <Reservation {...reservationProps} /> : null}
                {this.state.activeTab === tabs.PAYMENT ? <Payment 
                    orderList={this.state.orderList}
                /> : null}

                <LoginDialog show={this.state.showLoginDialog}
                    setSessionId={this.props.setSessionId}
                    onHide={() => this.setState({ showLoginDialog: false })} />

                
                {/* Chatbot */}
                <div>
                    <df-messenger
                        chat-icon="https://storage.googleapis.com/cloudprod-apiai/5833d656-dce0-4de6-b1a1-b5946043ba5c_x.png"
                        intent="WELCOME"
                        chat-title="Meja Bot"
                        agent-id="a11d8a36-5854-4b43-8306-a110222079a5"
                        language-code="en"
                    ></df-messenger>
                </div>

                {/* Call Waiter Button */}
                <Fab
                    // className='callWaiterButton'
                    mainButtonStyles={{
                        backgroundColor: this.state.callingWaiter ? '#27ae60': '#918585',
                        zIndex: '100 !important'
                    }}
                    icon={<FontAwesomeIcon icon={faConciergeBell} />}
                    onClick={() => this.handleCallWaiter(false)}
                    position={{bottom: 0, left: 0}}
                />
                
                {this.confirmOrderModal()}
                {this.confirmWaiterModal()}
            </div>

        );
    }
}