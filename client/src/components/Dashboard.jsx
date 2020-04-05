import React from 'react';
import { Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShoppingCart, faBars } from '@fortawesome/free-solid-svg-icons'
import { Menu } from 'src/components/menu/Menu';
import { Checkout } from 'src/components/checkout/Checkout';
import { navigate, Redirect } from "@reach/router";
import { About } from 'src/components/about/About';
import { Orders } from 'src/components/order/Orders';
import { Reservation } from 'src/components/reservation/Reservation';
import { LoginDialog } from 'src/components/reservation/LoginDialog';
import { Requests } from 'src/utilities/Requests';
import io from 'socket.io-client';
import 'src/styles/styles.css';

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
            activeTab: tabs.ALL,
            orderList: [],
            cart: new Map(),
            showLoginDialog: false,
            reservation: {},
        };
        this.navRef = React.createRef();
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
    // #endregion

    showLogin = () => {
        this.setState({ showLoginDialog: true });
    }

    // #region Event Handlers
    handleNavSelect = (event) => {
        if (event === 'logout') {
            localStorage.removeItem('sessionId');
            navigate('/');
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
                activeTab: tabs.ORDERS
            });

        } catch (err) {
            console.error(err);
        }
    }

    handleCloseOrder = () => {
        console.log('Closing Order and Paying');
        console.log(this.state.orderList);

        // Send entire session info to the backend to be stored in db
    }
    // #endregion

    render() {
        // if (!localStorage.getItem('sessionId')) {
        //     console.log('No session ID assigned');
        //     // Invalid Session or Session has Expired
        //     return <Redirect to='/' noThrow />;
        // }

        const reservationProps = {
            showLogin: this.showLogin,
        }

        return (
            <div>
                <Navbar collapseOnSelect variant="dark" bg="black" expand="lg" sticky="top" onSelect={(tab => this.setState({ activeTab: tab }))}>
                    <Navbar.Brand>Méja</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="mr-auto">
                            <Nav.Item>
                                <Nav.Link eventKey={tabs.ALL}>Menu</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey={tabs.RESERVATION}>Reservation</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey={tabs.ORDERS}>Orders</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey={tabs.CHECKOUT}><FontAwesomeIcon icon={faShoppingCart} /></Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey={tabs.ABOUT}>About</Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <Nav>
                            <Nav.Item>
                                <Nav.Link eventKey="logout">
                                    Sign out
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Navbar.Collapse>
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
                {this.state.activeTab === tabs.CHECKOUT ? <Checkout
                    cart={this.state.cart}
                    updateCart={this.updateCart}
                    handleOrderCart={this.handleOrderCart}
                /> : null}
                {this.state.activeTab === tabs.RESERVATION ? <Reservation {...reservationProps} /> : null}

                <LoginDialog show={this.state.showLoginDialog}
                    setSessionId={this.props.setSessionId}
                    onHide={() => this.setState({ showLoginDialog: false })} />
                <div>
<df-messenger
  intent="WELCOME"
  chat-title="Meja_Bot"
  agent-id="a11d8a36-5854-4b43-8306-a110222079a5"
  language-code="en"
></df-messenger>
                </div>
            </div>

        );
    }
}